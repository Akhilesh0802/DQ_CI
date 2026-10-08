from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.dataset import Dataset, DatasetVersion, VersionStatus
from app.models.profiling import ColumnMetric, ProfilingResult, QualityIssue
from app.models.user import User, UserRole
from app.models.log import ProcessLog
from app.schemas.dataset import DatasetDetailOut, DatasetListItemOut, DatasetOut, DatasetVersionOut
from app.services.dataset_service import add_new_version, register_new_dataset
from app.services.audit_service import log_action
from app.services.column_profiler import METRIC_DEFS
from app.services.report_service import build_excel_report
from app.services.job_runner import enqueue_profiling
from app.services.upload_guard import ACTIVE_STATUSES, ActiveUploadError, ensure_no_active_upload

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _ensure_can_access(dataset: Dataset, current_user: User) -> None:
    if current_user.role != UserRole.admin and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Dataset not found")


def _conflict(exc: ActiveUploadError) -> HTTPException:
    return HTTPException(status_code=409, detail=exc.message)


@router.post("/", response_model=DatasetOut)
def register_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    system: str = Form(None),
    reporting_period: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.uploader)),
):
    try:
        ensure_no_active_upload(db, current_user.id)  # ek user = ek active upload
        dataset = register_new_dataset(
            db=db,
            file_obj=file.file,
            filename=file.filename,
            owner_id=current_user.id,
            system=system,
            reporting_period=reporting_period,
        )
    except ActiveUploadError as exc:
        raise _conflict(exc)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    runner = enqueue_profiling(background_tasks, dataset.versions[0].id)
    log_action(db, current_user.id, "upload_dataset", f"file={file.filename}, dataset_id={dataset.id}, runner={runner}")
    return dataset


@router.post("/{dataset_id}/versions", response_model=DatasetVersionOut)
def upload_new_version(
    dataset_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.uploader)),
):
    """Existing dataset ka naya version (jaise corrected file). Owner ya admin kar sakta hai."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_can_access(dataset, current_user)

    try:
        ensure_no_active_upload(db, current_user.id)
        version = add_new_version(db, dataset, file.file, file.filename, current_user.id)
    except ActiveUploadError as exc:
        raise _conflict(exc)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    runner = enqueue_profiling(background_tasks, version.id)
    log_action(
        db, current_user.id, "upload_version",
        f"dataset_id={dataset.id}, version={version.version_number}, file={file.filename}, runner={runner}",
    )
    return version


@router.post("/versions/{version_id}/cancel")
def cancel_version(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queued/running job ko cancel karo (owner ya admin). Job agle checkpoint par ruk jata hai."""
    version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    _ensure_can_access(version.dataset, current_user)
    if version.status not in ACTIVE_STATUSES:
        raise HTTPException(status_code=409, detail="Ye job ab chal nahi rahi - cancel nahi ho sakti.")

    version.status = VersionStatus.cancelled
    db.add(ProcessLog(
        dataset_version_id=version.id, step="cancel_requested", status="success",
        message=f"{current_user.username} ne cancel kiya",
    ))
    db.commit()
    log_action(db, current_user.id, "cancel_upload", f"version_id={version_id}")
    return {"status": "cancelled", "version_id": version_id}


@router.get("/", response_model=list[DatasetListItemOut])
def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Dataset)
    if current_user.role != UserRole.admin:
        query = query.filter(Dataset.owner_id == current_user.id)
    datasets = query.order_by(Dataset.created_at.desc()).all()

    owner_ids = {ds.owner_id for ds in datasets}
    owners = (
        {u.id: u.username for u in db.query(User).filter(User.id.in_(owner_ids)).all()}
        if owner_ids else {}
    )

    items = []
    for ds in datasets:
        latest_version = (
            db.query(DatasetVersion)
            .filter(DatasetVersion.dataset_id == ds.id)
            .order_by(DatasetVersion.version_number.desc())
            .first()
        )
        items.append(DatasetListItemOut(
            id=ds.id,
            file_name=ds.file_name,
            owner_id=ds.owner_id,
            owner_username=owners.get(ds.owner_id),
            system=ds.system,
            reporting_period=ds.reporting_period,
            created_at=ds.created_at,
            status=latest_version.status if latest_version else None,
            version_number=latest_version.version_number if latest_version else None,
            uploaded_by=latest_version.uploaded_by if latest_version else None,
            record_count=latest_version.record_count if latest_version else None,
            uploaded_at=latest_version.uploaded_at if latest_version else None,
            version_id=latest_version.id if latest_version else None,
        ))
    return items


@router.get("/{dataset_id}", response_model=DatasetDetailOut)
def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_can_access(dataset, current_user)
    return dataset


@router.get("/versions/{version_id}/profile")
def get_profile(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    _ensure_can_access(version.dataset, current_user)

    result = db.query(ProfilingResult).filter(ProfilingResult.dataset_version_id == version_id).first()
    issues = db.query(QualityIssue).filter(QualityIssue.dataset_version_id == version_id).all()
    column_rows = (
        db.query(ColumnMetric)
        .filter(ColumnMetric.dataset_version_id == version_id)
        .order_by(ColumnMetric.id)
        .all()
    )
    columns = [
        {
            "column_name": c.column_name,
            "inferred_type": c.inferred_type,
            "detected_format": c.detected_format,
            "metrics": [
                {"key": key, "label": label, "value": c.metrics.get(key)}
                for key, label in METRIC_DEFS[c.inferred_type]
            ],
        }
        for c in column_rows
    ]

    return {
        "columns": columns,
        "status": version.status,
        "row_count": result.row_count if result else None,
        "null_counts": result.null_counts if result else None,
        "duplicate_count": result.duplicate_count if result else None,
        "unique_counts": result.unique_counts if result else None,
        "numeric_stats": result.numeric_stats if result else None,
        "issues": [{"column": i.column_name, "severity": i.severity, "message": i.message} for i in issues],
    }


@router.get("/versions/{version_id}/report")
def download_excel_report(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    _ensure_can_access(version.dataset, current_user)
    if version.status != VersionStatus.done:
        raise HTTPException(status_code=409, detail="Profiling abhi complete nahi hui - report baad mein download karo.")

    content = build_excel_report(db, version)
    log_action(db, current_user.id, "download_report", f"version_id={version_id}")
    filename = f"dataset-version-{version_id}-profiling-report.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
