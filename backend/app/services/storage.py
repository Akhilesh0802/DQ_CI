import os
import shutil
import uuid
from abc import ABC, abstractmethod

from app.core.config import settings


class StorageProvider(ABC):
    @abstractmethod
    def save(self, file_obj, original_filename: str) -> str:
        """File save karo, storage path/key return karo."""
        raise NotImplementedError

    @abstractmethod
    def delete(self, storage_path: str) -> None:
        raise NotImplementedError


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_path: str):
        self.base_path = base_path
        os.makedirs(self.base_path, exist_ok=True)

    def save(self, file_obj, original_filename: str) -> str:
        ext = os.path.splitext(original_filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        dest_path = os.path.join(self.base_path, unique_name)
        with open(dest_path, "wb") as out_file:
            shutil.copyfileobj(file_obj, out_file)
        return dest_path

    def delete(self, storage_path: str) -> None:
        if os.path.exists(storage_path):
            os.remove(storage_path)


def get_storage_provider() -> StorageProvider:
    if settings.STORAGE_PROVIDER == "local":
        return LocalStorageProvider(settings.STORAGE_LOCAL_PATH)
    raise ValueError(f"Unknown STORAGE_PROVIDER: {settings.STORAGE_PROVIDER}")