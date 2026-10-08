from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies import get_current_user, require_role
from app.models.rules import RuleConfig
from app.models.user import User, UserRole
from app.services.audit_service import log_action
from app.services.rules_config import DEFAULT_RULES, get_effective_rules

router = APIRouter(prefix="/rules", tags=["rules"])


class RuleUpdate(BaseModel):
    threshold: float = Field(ge=0)
    severity: Literal["warning", "error"]
    enabled: bool = True
    excluded_columns: list[str] = []


@router.get("/")
def list_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Koi bhi logged-in user dekh sakta hai kaunse rules lag rahe hain."""
    return list(get_effective_rules(db).values())


@router.put("/{rule_key}")
def update_rule(
    rule_key: str,
    payload: RuleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    default = DEFAULT_RULES.get(rule_key)
    if not default:
        raise HTTPException(status_code=404, detail="Unknown rule")
    if default["unit"] == "%" and payload.threshold > 100:
        raise HTTPException(status_code=400, detail="Percentage threshold 0 se 100 ke beech hona chahiye.")

    excluded = []
    if default["column_level"]:
        for name in payload.excluded_columns:
            name = name.strip()
            if name and name not in excluded:
                excluded.append(name)

    row = db.query(RuleConfig).filter(RuleConfig.rule_key == rule_key).first()
    if not row:
        row = RuleConfig(rule_key=rule_key)
        db.add(row)
    row.threshold = payload.threshold
    row.severity = payload.severity
    row.enabled = payload.enabled
    row.excluded_columns = excluded
    row.updated_by = admin.id
    db.commit()

    log_action(
        db, admin.id, "update_rule",
        f"{rule_key}: threshold={payload.threshold}, severity={payload.severity}, "
        f"enabled={payload.enabled}, excluded={excluded}",
    )
    return get_effective_rules(db)[rule_key]


@router.delete("/{rule_key}")
def reset_rule(
    rule_key: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(UserRole.admin)),
):
    """Rule ko code wale default par wapas le jao."""
    if rule_key not in DEFAULT_RULES:
        raise HTTPException(status_code=404, detail="Unknown rule")
    row = db.query(RuleConfig).filter(RuleConfig.rule_key == rule_key).first()
    if row:
        db.delete(row)
        db.commit()
    log_action(db, admin.id, "reset_rule", rule_key)
    return get_effective_rules(db)[rule_key]
