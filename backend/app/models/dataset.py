import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class VersionStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class Dataset(Base):
    """
    Ek logical dataset - jaise 'Monthly Sales Report'. File khud nahi hoti
    isमें, wo DatasetVersion mein hoti hai - taaki version history clean rahे.
    """
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    system = Column(String, nullable=True)
    reporting_period = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    versions = relationship("DatasetVersion", back_populates="dataset")


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    storage_path = Column(String, nullable=False)
    record_count = Column(Integer, nullable=True)
    status = Column(Enum(VersionStatus), default=VersionStatus.uploaded)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="versions")