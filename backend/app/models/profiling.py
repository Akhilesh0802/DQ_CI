from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text

from app.db.session import Base


class ProfilingResult(Base):
    __tablename__ = "profiling_results"

    id = Column(Integer, primary_key=True, index=True)
    dataset_version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=False)
    row_count = Column(Integer, nullable=False)
    null_counts = Column(JSON, nullable=False)
    duplicate_count = Column(Integer, nullable=False)
    unique_counts = Column(JSON, nullable=False)
    numeric_stats = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class QualityIssue(Base):
    __tablename__ = "quality_issues"

    id = Column(Integer, primary_key=True, index=True)
    dataset_version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=False)
    column_name = Column(String, nullable=True)
    severity = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ColumnMetric(Base):
    """Har column ka inferred type + uske type ke saare metrics (Phase 2 reference jaisa)."""
    __tablename__ = "column_metrics"

    id = Column(Integer, primary_key=True, index=True)
    dataset_version_id = Column(Integer, ForeignKey("dataset_versions.id"), nullable=False, index=True)
    column_name = Column(String, nullable=False)
    inferred_type = Column(String, nullable=False)  # NUMERIC / DATE / TEXT / BOOLEAN
    detected_format = Column(String, nullable=True)  # sirf DATE ke liye
    metrics = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
