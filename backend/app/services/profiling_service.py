import traceback

import pandas as pd
from sqlalchemy.orm import Session

from app.models.dataset import DatasetVersion, VersionStatus
from app.models.log import ProcessLog
from app.models.profiling import ColumnMetric, ProfilingResult, QualityIssue
from app.services.column_profiler import json_safe, profile_dataframe
from app.services.rules_config import get_effective_rules


class JobCancelled(Exception):
    """User/admin ne job cancel kar diya (status 'cancelled' DB mein set hai)."""


def _check_cancelled(db: Session, version: DatasetVersion):
    db.refresh(version)  # doosre session (cancel API) ka badlav yahan dikhe
    if version.status == VersionStatus.cancelled:
        raise JobCancelled()


def _delete_partial_results(db: Session, version_id: int):
    for model in (QualityIssue, ColumnMetric, ProfilingResult):
        db.query(model).filter(model.dataset_version_id == version_id).delete()
    db.commit()


def _log(db: Session, version_id: int, step: str, status: str, message: str = ""):
    db.add(ProcessLog(dataset_version_id=version_id, step=step, status=status, message=message))
    db.commit()


def _read_dataframe(storage_path: str) -> pd.DataFrame:
    # dtype=str: reference (Snowflake SP) bhi har column ko string maanke type infer karta hai
    if storage_path.lower().endswith(".csv"):
        return pd.read_csv(storage_path, dtype=str, encoding_errors="replace")
    return pd.read_excel(storage_path, dtype=str)


def run_profiling(db: Session, version_id: int):
    version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not version:
        return
    # Idempotent: Celery task redeliver ho (worker crash) toh done/cancelled job dobara nahi chalta,
    # aur adhoori profiling ke partial results saaf hokar fresh run hota hai.
    if version.status in (VersionStatus.done, VersionStatus.cancelled):
        return

    # Poora function try/except ke andar - kahin bhi crash ho, status "processing" mein
    # atka na rahe, aur asli error terminal mein saaf print ho.
    try:
        _delete_partial_results(db, version_id)
        version.status = VersionStatus.processing
        db.commit()
        _log(db, version_id, "start", "started")

        _log(db, version_id, "read_file", "started")
        df = _read_dataframe(version.storage_path)
        _log(db, version_id, "read_file", "success", f"{len(df)} rows, {len(df.columns)} columns")
        _check_cancelled(db, version)

        _log(db, version_id, "completeness_check", "started")
        null_counts = {str(k): int(v) for k, v in df.isnull().sum().to_dict().items()}
        _log(db, version_id, "completeness_check", "success")

        _log(db, version_id, "duplicate_check", "started")
        duplicate_count = int(df.duplicated().sum())
        _log(db, version_id, "duplicate_check", "success", f"{duplicate_count} duplicate rows")

        _log(db, version_id, "uniqueness_check", "started")
        unique_counts = {str(k): int(v) for k, v in df.nunique().to_dict().items()}
        _log(db, version_id, "uniqueness_check", "success")
        _check_cancelled(db, version)

        # Type inference + per-type metrics (numeric / date / text / boolean)
        rules = get_effective_rules(db)
        fmt_rule = rules["format_mismatch"]
        _log(db, version_id, "type_inference_and_metrics", "started")
        columns = profile_dataframe(df, format_threshold=fmt_rule["threshold"] / 100.0)
        type_summary = {}
        for col in columns:
            type_summary[col["inferred_type"]] = type_summary.get(col["inferred_type"], 0) + 1
        _log(db, version_id, "type_inference_and_metrics", "success", f"column types: {type_summary}")
        _check_cancelled(db, version)

        numeric_stats = {
            c["column_name"]: {
                "mean": c["metrics"].get("average_value"),
                "min": c["metrics"].get("minimum_value"),
                "max": c["metrics"].get("maximum_value"),
            }
            for c in columns if c["inferred_type"] == "NUMERIC"
        }

        db.add(ProfilingResult(
            dataset_version_id=version_id,
            row_count=len(df),
            null_counts=json_safe(null_counts),
            duplicate_count=duplicate_count,
            unique_counts=json_safe(unique_counts),
            numeric_stats=json_safe(numeric_stats),
        ))
        for c in columns:
            db.add(ColumnMetric(
                dataset_version_id=version_id,
                column_name=c["column_name"],
                inferred_type=c["inferred_type"],
                detected_format=c["detected_format"],
                metrics=c["metrics"],
            ))

        # Rules - thresholds/severity/on-off admin ke settings se (default: code wale rules)
        miss_rule, dup_rule = rules["missing_values"], rules["duplicate_rows"]

        def _describe(rule, op):
            if not rule["enabled"]:
                return f"{rule['label']}: OFF"
            return f"{rule['label']} {op} {rule['threshold']:g}{rule['unit'] if rule['unit'] == '%' else ''} ({rule['severity']})"

        _log(db, version_id, "rule_evaluation", "started",
             "; ".join([_describe(miss_rule, ">"), _describe(dup_rule, ">"), _describe(fmt_rule, ">=")]))
        row_count = len(df) or 1

        if miss_rule["enabled"]:
            for col, count in null_counts.items():
                if col in miss_rule["excluded_columns"]:
                    continue
                pct = (count / row_count) * 100
                if pct > miss_rule["threshold"]:
                    db.add(QualityIssue(
                        dataset_version_id=version_id, column_name=col, severity=miss_rule["severity"],
                        message=f"{pct:.1f}% values missing in '{col}'",
                    ))

        if dup_rule["enabled"] and duplicate_count > dup_rule["threshold"]:
            db.add(QualityIssue(
                dataset_version_id=version_id, column_name=None, severity=dup_rule["severity"],
                message=f"{duplicate_count} duplicate rows found",
            ))

        if fmt_rule["enabled"]:
            for c in columns:
                errors = c["metrics"].get("data_error_count") or 0
                if c["inferred_type"] == "TEXT" and errors > 0 and c["expected_type"] \
                        and c["column_name"] not in fmt_rule["excluded_columns"]:
                    db.add(QualityIssue(
                        dataset_version_id=version_id, column_name=c["column_name"], severity=fmt_rule["severity"],
                        message=f"{errors} values don't match {c['expected_type'].lower()} format in '{c['column_name']}'",
                    ))
        _log(db, version_id, "rule_evaluation", "success")
        _check_cancelled(db, version)

        version.status = VersionStatus.done
        version.record_count = len(df)
        db.commit()
        _log(db, version_id, "complete", "success")

    except JobCancelled:
        db.rollback()
        _delete_partial_results(db, version_id)
        _log(db, version_id, "cancelled", "success", "Job cancel kar diya gaya")

    except Exception as e:
        print("\n" + "=" * 60)
        print(f"PROFILING FAILED for dataset_version_id={version_id}")
        traceback.print_exc()
        print("=" * 60 + "\n")
        try:
            db.rollback()
            version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
            version.status = VersionStatus.failed
            db.commit()
            _log(db, version_id, "complete", "failed", str(e))
        except Exception:
            pass
