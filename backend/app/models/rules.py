from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String

from app.db.session import Base


class RuleConfig(Base):
    """
    Admin ne jo rule settings badli hain. Row na ho toh code wale defaults
    (services/rules_config.py) use hote hain.
    """
    __tablename__ = "rule_configs"

    id = Column(Integer, primary_key=True, index=True)
    rule_key = Column(String, unique=True, nullable=False, index=True)
    threshold = Column(Float, nullable=False)
    severity = Column(String, nullable=False)  # "warning" / "error"
    enabled = Column(Boolean, nullable=False, default=True)
    excluded_columns = Column(JSON, nullable=False, default=list)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)
