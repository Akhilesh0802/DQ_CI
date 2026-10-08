from sqlalchemy import text

from app.db.session import SessionLocal, engine
from app.services.upload_guard import fail_stale_versions

ONE_ACTIVE_UPLOAD_INDEX = "uq_one_active_version_per_user"


def run_startup_tasks():
    # 1. Purane atke hue jobs saaf karo (index banane se pehle, warna duplicates ki wajah se index fail ho sakta hai)
    db = SessionLocal()
    try:
        cleaned = fail_stale_versions(db)
        if cleaned:
            print(f"[startup] {cleaned} atke hue job(s) failed mark kiye.")
    finally:
        db.close()

    # 2. DB-level guarantee: ek user ke 2 active versions kabhi nahi (race condition ke liye).
    #    create_all purani tables mein index nahi jodta, isliye yahan explicitly (IF NOT EXISTS, safe to re-run).
    ddl = (
        f"CREATE UNIQUE INDEX IF NOT EXISTS {ONE_ACTIVE_UPLOAD_INDEX} "
        "ON dataset_versions (uploaded_by) WHERE status IN ('uploaded', 'processing')"
    )
    try:
        with engine.begin() as conn:
            conn.execute(text(ddl))
    except Exception as exc:
        print(f"[startup] WARNING: unique index nahi ban paya ({exc.__class__.__name__}). "
              "App-level check chalta rahega, par race condition se poori suraksha nahi hai.")
