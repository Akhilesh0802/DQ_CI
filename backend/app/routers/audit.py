from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies import require_role
from app.models.log import AuditLog
from app.models.user import User, UserRole

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("/")
def list_audit_logs(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """
    Sirf admin dekh sakta hai - kaun, kab, kya action kiya.
    Naya sabse upar (recent-first).
    """
    results = (
        db.query(AuditLog, User.username)
        .join(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "username": username,
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at,
        }
        for log, username in results
    ]
