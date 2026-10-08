"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "../components/AuthShell";
import { AuthHeading, ErrorBanner, PasswordField, PrimaryButton, TextField } from "../components/AuthFields";
import { registerUser } from "../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError("Username, email, phone aur password sab daalna zaroori hai.");
      return;
    }
    setIsSubmitting(true);
    try {
      await registerUser({ username: name, email, phone, password });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration fail ho gaya.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell subtitle="Set up your account and start catching data issues before they become problems.">
      <AuthHeading eyebrow="Data Quality Tool" title="Create account" subtitle="Get started with your team" />

      <form onSubmit={handleRegister} className="flex flex-col gap-5">
        <ErrorBanner message={error} />

        <TextField id="username" label="Username" value={name} onChange={setName} placeholder="Akhilesh" autoComplete="username" />
        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="akhilesh@gt.com"
          autoComplete="email"
        />
        <TextField
          id="phone"
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="+91 98765 43210"
          autoComplete="tel"
        />
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" />

        <PrimaryButton disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create account"}</PrimaryButton>
      </form>

      <p className="text-sm text-[#5b5370]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#4f2d7f] font-bold hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
