from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.db.session import Base


class ProcessLog(Base):
    """
    Ek profiling job ke andar har step ka record - jaise
    'null_check started', 'null_check success'. Isी se
    download-able log file banegi baad mein.
    """
    __tablename__ = "process_logs"

    id = Column(Integer, primary_key=True, index=True)
    dataset_version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=False)
    step = Column(String, nullable=False)          # e.g. "completeness_check"
    status = Column(String, nullable=False)        # "started" / "success" / "failed"
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """User activity trail - login, upload, cancel, waise."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)         # e.g. "login", "upload_dataset"
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)