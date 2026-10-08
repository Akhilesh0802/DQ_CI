from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.otp import PasswordResetOTP
from app.models.user import User
from app.schemas.user import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserOut,
)
from app.services.audit_service import log_action
from app.services.otp_service import generate_otp, get_otp_expiry, send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        username=user_in.username,
        email=user_in.email,
        phone=user_in.phone,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(db, user.id, "register", f"role={user.role.value}")
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    access_token = create_access_token(data={"sub": user.username, "role": user.role.value})
    log_action(db, user.id, "login")
    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    # Jaanbujh kar hamesha same message dete hain, chahe email mile ya nahi -
    # isse koi ye pata nahi laga sakta kaunse emails registered hain.
    if user:
        otp_code = generate_otp()
        db.add(PasswordResetOTP(
            email=payload.email,
            otp_code=otp_code,
            expires_at=get_otp_expiry(),
        ))
        db.commit()
        send_otp_email(payload.email, otp_code)
        log_action(db, user.id, "forgot_password_requested")

    return {"message": "Agar ye email registered hai, OTP bhej diya gaya hai."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    otp_record = (
        db.query(PasswordResetOTP)
        .filter(
            PasswordResetOTP.email == payload.email,
            PasswordResetOTP.otp_code == payload.otp_code,
            PasswordResetOTP.used == False,  # noqa: E712
        )
        .order_by(PasswordResetOTP.created_at.desc())
        .first()
    )

    if not otp_record or otp_record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP galat hai ya expire ho gaya hai.")

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    otp_record.used = True
    db.commit()

    log_action(db, user.id, "password_reset")
    return {"message": "Password reset ho gaya. Ab naye password se login karo."}
