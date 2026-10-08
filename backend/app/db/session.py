import logging
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# SQL query logging - har query (SELECT/INSERT/UPDATE/DELETE) ek alag
# file mein likhi jati hai, terminal ko saaf rakhne ke liye. Off karna
# ho toh .env mein SQL_ECHO=False kar dena.
if settings.SQL_ECHO:
    os.makedirs(os.path.dirname(settings.SQL_LOG_FILE) or ".", exist_ok=True)
    # SQLAlchemy ka asli logger "sqlalchemy.engine.Engine" hai (child logger) -
    # "sqlalchemy.engine" pe propagate=False lagane se console duplicate
    # nahi rukta, isliye seedha ispe hi lagana zaroori hai.
    sql_logger = logging.getLogger("sqlalchemy.engine.Engine")
    sql_logger.setLevel(logging.INFO)
    sql_logger.propagate = False  # console mein duplicate na ho
    if not sql_logger.handlers:
        file_handler = logging.FileHandler(settings.SQL_LOG_FILE)
        file_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
        sql_logger.addHandler(file_handler)

engine = create_engine(settings.DATABASE_URL, echo=settings.SQL_ECHO)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Har request ke liye naya DB session, request khatam hote hi close."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
