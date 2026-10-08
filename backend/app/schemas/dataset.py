from datetime import datetime

from pydantic import BaseModel

from app.models.dataset import VersionStatus


class DatasetVersionOut(BaseModel):
    id: int
    version_number: int
    record_count: int | None
    status: VersionStatus
    uploaded_by: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class DatasetOut(BaseModel):
    id: int
    file_name: str
    owner_id: int
    system: str | None
    reporting_period: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetDetailOut(DatasetOut):
    versions: list[DatasetVersionOut] = []

class DatasetListItemOut(BaseModel):
    id: int
    file_name: str
    owner_id: int
    owner_username: str | None = None
    system: str | None
    reporting_period: str | None
    created_at: datetime
    status: VersionStatus | None = None
    version_number: int | None = None
    uploaded_by: int | None = None
    record_count: int | None = None
    uploaded_at: datetime | None = None
    version_id: int | None = None