import os

import pandas as pd
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.dataset import Dataset, DatasetVersion
from app.services.storage import get_storage_provider
from app.services.upload_guard import ActiveUploadError

ALLOWED_EXTENSIONS = (".csv", ".xlsx")


def validate_upload_filename(filename: str | None) -> None:
    if not filename or os.path.splitext(filename)[1].lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Sirf .csv ya .xlsx file upload kar sakte ho.")


def count_records(file_obj, filename: str) -> int:
    """CSV ya Excel dono handle karta hai. File padhi na jaye toh ValueError (router 400 deta hai)."""
    file_obj.seek(0)
    try:
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(file_obj, dtype=str, encoding_errors="replace")
        else:
            df = pd.read_excel(file_obj, dtype=str)
    except Exception as exc:
        raise ValueError(f"File padhi nahi ja saki (corrupt ya galat format): {exc.__class__.__name__}") from exc
    finally:
        file_obj.seek(0)
    return len(df)


def _is_active_upload_conflict(exc: IntegrityError) -> bool:
    msg = str(exc.orig).lower()
    return "uq_one_active_version_per_user" in msg or "dataset_versions.uploaded_by" in msg


def _commit_or_conflict(db: Session, storage, storage_path: str) -> None:
    """Commit karo; agar DB ka 'ek active upload per user' index toot'a (race), toh file hata ke ActiveUploadError."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        storage.delete(storage_path)
        if _is_active_upload_conflict(exc):
            raise ActiveUploadError() from exc
        raise


def register_new_dataset(
    db: Session,
    file_obj,
    filename: str,
    owner_id: int,
    system: str | None,
    reporting_period: str | None,
) -> Dataset:
    validate_upload_filename(filename)
    record_count = count_records(file_obj, filename)

    storage = get_storage_provider()
    storage_path = storage.save(file_obj, filename)

    dataset = Dataset(
        file_name=filename,
        owner_id=owner_id,
        system=system,
        reporting_period=reporting_period,
    )
    db.add(dataset)
    db.flush()  # dataset.id chahiye version banane se pehle, commit se pehle

    db.add(DatasetVersion(
        dataset_id=dataset.id,
        version_number=1,
        storage_path=storage_path,
        record_count=record_count,
        uploaded_by=owner_id,
    ))
    _commit_or_conflict(db, storage, storage_path)
    db.refresh(dataset)
    return dataset


def add_new_version(
    db: Session, dataset: Dataset, file_obj, filename: str, uploaded_by: int
) -> DatasetVersion:
    """Existing dataset ka naya version (jaise corrected file). Dataset ka system/period same rehta hai."""
    validate_upload_filename(filename)
    record_count = count_records(file_obj, filename)

    storage = get_storage_provider()
    storage_path = storage.save(file_obj, filename)

    latest = max((v.version_number for v in dataset.versions), default=0)
    version = DatasetVersion(
        dataset_id=dataset.id,
        version_number=latest + 1,
        storage_path=storage_path,
        record_count=record_count,
        uploaded_by=uploaded_by,
    )
    db.add(version)
    _commit_or_conflict(db, storage, storage_path)
    db.refresh(version)
    return version
