from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import Base, engine
from app.db.startup import run_startup_tasks
from app.services.job_runner import get_queue_status
from app.routers import auth, dataset, logs, audit, rules

# Phase 1 ke liye create_all - table structure jaldi banane/badalne
# ke liye kaam aata hai. Schema stabilize hone par Alembic migrations
# pe switch karna (production standard).
Base.metadata.create_all(bind=engine)
run_startup_tasks()  # atke jobs saaf + 'ek user = ek active upload' DB index

app = FastAPI(title="Data Quality & Profiling Tool")

# CORS - bina isके browser Next.js (localhost:3000) se FastAPI
# (localhost:8000) ko calls nahi karne dеgा, security ki wajah se.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dataset.router)
app.include_router(logs.router)
app.include_router(audit.router)
app.include_router(rules.router)

@app.get("/health")
def health_check():
    info = {"status": "ok", "job_runner": "celery" if settings.USE_CELERY else "background"}
    if settings.USE_CELERY:
        info.update(get_queue_status())  # redis up/down, kitne workers sun rahe hain
    return info
