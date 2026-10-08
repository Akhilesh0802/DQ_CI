"""
Celery app. Worker chalane ka command (backend/ folder mein, venv activate karke):

    Windows : celery -A app.worker.celery_app worker --loglevel=info --pool=threads --concurrency=4
    Linux   : celery -A app.worker.celery_app worker --loglevel=info --concurrency=4

Job ka status/result Postgres mein hi store hota hai (dataset_versions.status), isliye
Celery ka result backend nahi chahiye.
"""
from celery import Celery

from app.core.config import settings

celery_app = Celery("dq_tool", broker=settings.REDIS_URL)
celery_app.conf.update(
    task_ignore_result=True,
    task_acks_late=True,               # worker crash ho toh job dobara queue mein aa jaye
    worker_prefetch_multiplier=1,      # ek worker ek time pe ek hi job pakde (lambi jobs ke liye fair)
    broker_connection_retry_on_startup=True,
    # Redis band ho toh API request atke nahi - jaldi fail ho aur BackgroundTasks par fallback ho
    broker_transport_options={"socket_connect_timeout": 2, "socket_timeout": 5},
    task_publish_retry_policy={"max_retries": 1, "interval_start": 0, "interval_step": 0.2, "interval_max": 0.5},
)


@celery_app.task(name="dq.profile_version")
def profile_version_task(version_id: int):
    from app.services.job_runner import run_profiling_job

    run_profiling_job(version_id)
