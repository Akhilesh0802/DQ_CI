"""
Rule: ek user ke paas ek time par sirf EK active upload (status uploaded/processing) ho sakta hai.
Alag-alag users ke uploads ek saath chal sakte hain.

Do layers:
  1. yahan application-level check (friendly message ke saath, file save karne se pehle)
  2. DB ka partial unique index (db/startup.py) - agar same user ke 2 requests bilkul ek saath aayein
     (race), toh DB doosre ko reject kar deta hai.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.dataset import DatasetVersion, VersionStatus
from app.models.log import ProcessLog

ACTIVE_STATUSES = (VersionStatus.uploaded, VersionStatus.processing)


class ActiveUploadError(Exception):
    def __init__(self, version: DatasetVersion | None = None):
        self.version = version
        if version is not None:
            label = "queue mein hai" if version.status == VersionStatus.uploaded else "process ho raha hai"
            name = version.dataset.file_name if version.dataset else "pichla file"
            message = (
                f"Aapka pichla upload ('{name}') abhi {label}. "
                "Uske complete hone (ya cancel karne) ke baad hi naya upload kar sakte ho."
            )
        else:
            message = "Aapka ek upload abhi chal raha hai. Uske complete hone ke baad naya upload karo."
        super().__init__(message)
        self.message = message


def fail_stale_versions(db: Session, user_id: int | None = None) -> int:
    """Bahut der se atke active jobs ko failed mark karo, taaki user permanently block na rahe."""
    cutoff = datetime.utcnow() - timedelta(minutes=settings.ACTIVE_UPLOAD_STALE_MINUTES)
    query = db.query(DatasetVersion).filter(
        DatasetVersion.status.in_(ACTIVE_STATUSES), DatasetVersion.uploaded_at < cutoff
    )
    if user_id is not None:
        query = query.filter(DatasetVersion.uploaded_by == user_id)
    stale = query.all()
    for version in stale:
        version.status = VersionStatus.failed
        db.add(ProcessLog(
            dataset_version_id=version.id,
            step="stale_job_cleanup",
            status="failed",
            message=f"{settings.ACTIVE_UPLOAD_STALE_MINUTES} minute mein koi result nahi aaya - failed mark kiya gaya.",
        ))
    if stale:
        db.commit()
    return len(stale)


def get_active_version(db: Session, user_id: int) -> DatasetVersion | None:
    return (
        db.query(DatasetVersion)
        .filter(DatasetVersion.uploaded_by == user_id, DatasetVersion.status.in_(ACTIVE_STATUSES))
        .first()
    )


def ensure_no_active_upload(db: Session, user_id: int) -> None:
    fail_stale_versions(db, user_id)
    active = get_active_version(db, user_id)
    if active:
        raise ActiveUploadError(active)
