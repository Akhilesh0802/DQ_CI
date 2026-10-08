from app.core.config import settings
from app.db.session import SessionLocal
from app.services.profiling_service import run_profiling


def run_profiling_job(version_id: int):
    """Profiling ek apne DB session mein chalti hai (request ka session tab tak band ho chuka hota hai)."""
    db = SessionLocal()
    try:
        run_profiling(db, version_id)
    finally:
        db.close()


def enqueue_profiling(background_tasks, version_id: int) -> str:
    """
    Job ko queue karo. USE_CELERY=True ho toh Celery (Redis) mein; Redis down ho toh
    BackgroundTasks par fallback - taaki upload kabhi sirf Redis ki wajah se na ruke.
    Returns: "celery" ya "background".
    """
    if settings.USE_CELERY:
        try:
            from app.worker import profile_version_task

            profile_version_task.delay(version_id)
            return "celery"
        except Exception as exc:  # Redis unreachable, waise
            print(f"[job_runner] Celery queue fail hui ({exc!r}) - BackgroundTasks par fallback.")
    background_tasks.add_task(run_profiling_job, version_id)
    return "background"


def get_queue_status() -> dict:
    """/health ke liye: Redis up hai? Kitne Celery workers sun rahe hain?"""
    status = {"redis": "down", "workers": 0}
    try:
        import redis

        redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1).ping()
        status["redis"] = "up"
    except Exception:
        return status
    try:
        from app.worker import celery_app

        status["workers"] = len(celery_app.control.inspect(timeout=1).ping() or {})
    except Exception:
        pass
    return status
