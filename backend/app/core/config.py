from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/dq_tool"

    SECRET_KEY: str = "change-this-in-.env-file"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    STORAGE_PROVIDER: str = "local"
    STORAGE_LOCAL_PATH: str = "./uploaded_files"

    FRONTEND_ORIGIN: str = "http://localhost:3000"

    ANTHROPIC_API_KEY: str = ""

    # SQL query logging - har query file mein likhi jayegi (audit ke liye)
    SQL_ECHO: bool = True
    SQL_LOG_FILE: str = "logs/sql_queries.log"

    # Background jobs: False = FastAPI BackgroundTasks (Redis nahi chahiye),
    # True = Celery worker + Redis (alag terminal mein worker chalana padta hai)
    USE_CELERY: bool = False
    REDIS_URL: str = "redis://localhost:6379/0"

    # Koi upload itne minute baad bhi "uploaded/processing" mein atka ho (worker crash, waise)
    # toh use failed maan ke user ka lock chhod dete hain.
    ACTIVE_UPLOAD_STALE_MINUTES: int = 60

    class Config:
        env_file = ".env"


settings = Settings()