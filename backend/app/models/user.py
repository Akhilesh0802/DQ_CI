import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String

from app.db.session import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    uploader = "uploader"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.viewer)
    created_at = Column(DateTime, default=datetime.utcnow)