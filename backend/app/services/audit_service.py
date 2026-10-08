from sqlalchemy.orm import Session

from app.models.log import AuditLog


def log_action(db: Session, user_id: int, action: str, details: str = ""):
    """
    Har important user action yahan se record hota hai - kaun, kab, kya.
    Ye 'audit_logs' table mein jata hai, jo pehle bana tha lekin koi
    endpoint use nahi kar raha tha.
    """
    db.add(AuditLog(user_id=user_id, action=action, details=details))
    db.commit()
