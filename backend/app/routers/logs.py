from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.dataset import DatasetVersion
from app.models.user import User, UserRole
from app.services.log_service import build_log_text
from app.services.audit_service import log_action

router = APIRouter(prefix="/datasets", tags=["logs"])


@router.get("/versions/{version_id}/log")
def download_log(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    version = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Same ownership rule jo dataset router mein hai
    if current_user.role != UserRole.admin and version.dataset.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Version not found")

    log_text = build_log_text(db, version_id)
    filename = f"dataset-version-{version_id}-log.txt"

    log_action(db, current_user.id, "download_log", f"version_id={version_id}")

    return PlainTextResponse(
        content=log_text,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
