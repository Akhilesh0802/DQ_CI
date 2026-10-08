from sqlalchemy.orm import Session

from app.models.log import ProcessLog


def build_log_text(db: Session, version_id: int) -> str:
    logs = (
        db.query(ProcessLog)
        .filter(ProcessLog.dataset_version_id == version_id)
        .order_by(ProcessLog.created_at.asc())
        .all()
    )

    if not logs:
        return "Is dataset version ke liye abhi tak koi processing log nahi mila."

    lines = [f"Processing log — dataset version #{version_id}", "=" * 50, ""]
    for log in logs:
        timestamp = log.created_at.strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}] {log.step} — {log.status}"
        if log.message:
            line += f" — {log.message}"
        lines.append(line)

    return "\n".join(lines)
