"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "../components/AuthShell";
import { AuthHeading, ErrorBanner, InfoBanner, PasswordField, PrimaryButton, TextField } from "../components/AuthFields";
import { requestPasswordReset, resetPassword } from "../lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Apna email daalo.");
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setInfo("Agar ye email registered hai, OTP bhej diya gaya hai. (Abhi ke liye OTP backend terminal mein print hota hai.)");
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!otpCode.trim() || !newPassword) {
      setError("OTP aur naya password dono daalo.");
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword(email, otpCode, newPassword);
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset fail ho gaya.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell subtitle="Locked out? We'll get you back in with a one-time code.">
      <AuthHeading
        eyebrow="Data Quality Tool"
        title={step === "request" ? "Forgot password" : "Reset password"}
        subtitle={step === "request" ? "Apna registered email daalo, OTP bhejenge." : `OTP bheja gaya ${email} pe.`}
      />

      {step === "request" ? (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-6">
          <ErrorBanner message={error} />
          <TextField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="akhilesh@gt.com"
            autoComplete="email"
          />
          <PrimaryButton disabled={isSubmitting}>{isSubmitting ? "Sending..." : "Send OTP"}</PrimaryButton>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="flex flex-col gap-6">
          <ErrorBanner message={error} />
          <InfoBanner message={info} />
          <TextField id="otp" label="OTP code" value={otpCode} onChange={setOtpCode} placeholder="6-digit code" autoComplete="one-time-code" />
          <PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PrimaryButton disabled={isSubmitting}>{isSubmitting ? "Resetting..." : "Reset password"}</PrimaryButton>
        </form>
      )}

      <p className="text-sm text-[#5b5370]">
        <Link href="/login" className="text-[#4f2d7f] font-bold hover:underline">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
