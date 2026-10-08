"""
Data-quality rules. Defaults wahi hain jo pehle profiling code mein fixed the
(naye rules nahi jode). Admin inke threshold / severity / on-off / excluded columns
badal sakta hai; badlav sirf aage ke uploads par lagta hai.
"""
from sqlalchemy.orm import Session

from app.models.rules import RuleConfig

DEFAULT_RULES = {
    "missing_values": {
        "key": "missing_values",
        "label": "Missing values",
        "description": "Kisi column mein itne % se zyada values missing hon toh issue banao.",
        "unit": "%",
        "column_level": True,
        "threshold": 5.0,
        "severity": "warning",
        "enabled": True,
    },
    "duplicate_rows": {
        "key": "duplicate_rows",
        "label": "Duplicate rows",
        "description": "Itne se zyada poori-row duplicates hon toh issue banao.",
        "unit": "rows",
        "column_level": False,
        "threshold": 0,
        "severity": "error",
        "enabled": True,
    },
    "format_mismatch": {
        "key": "format_mismatch",
        "label": "Format mismatch",
        "description": (
            "Column ki itni % (ya zyada) values numeric/date/boolean ho, "
            "par baaki values us format se match na karein toh issue banao."
        ),
        "unit": "%",
        "column_level": True,
        "threshold": 80.0,
        "severity": "warning",
        "enabled": True,
    },
}


def get_effective_rules(db: Session) -> dict:
    """Defaults + admin overrides (DB) merge karke, rule_key -> rule dict."""
    overrides = {r.rule_key: r for r in db.query(RuleConfig).all()}
    effective = {}
    for key, default in DEFAULT_RULES.items():
        rule = {**default, "excluded_columns": [], "is_default": True}
        row = overrides.get(key)
        if row:
            rule.update(
                threshold=row.threshold,
                severity=row.severity,
                enabled=row.enabled,
                excluded_columns=list(row.excluded_columns or []),
                is_default=False,
            )
        effective[key] = rule
    return effective
