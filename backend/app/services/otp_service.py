import random
from datetime import datetime, timedelta


def generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"


def get_otp_expiry() -> datetime:
    return datetime.utcnow() + timedelta(minutes=10)


def send_otp_email(to_email: str, otp_code: str) -> None:
    """
    TODO: jab real email bhejna ho, yahan Gmail SMTP (smtplib) ka code
    aayega (free hai, bas Gmail App Password chahiye hoga). Abhi ke liye
    bilkul free/zero-setup tareeka - backend terminal mein print kar rahe hain.
    """
    print("\n" + "=" * 50)
    print(f"PASSWORD RESET OTP for {to_email}: {otp_code}")
    print("Ye 10 minute ke liye valid hai.")
    print("=" * 50 + "\n")
