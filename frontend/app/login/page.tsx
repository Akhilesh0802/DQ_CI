"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "../components/AuthShell";
import { AuthHeading, ErrorBanner, PasswordField, PrimaryButton, TextField } from "../components/AuthFields";
import { API_BASE_URL, setToken } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Khali fields par server ko call hi nahi karte
    if (!username.trim() || !password) {
      setError("Username aur password dono daalo.");
      return;
    }
    setIsSubmitting(true);

    try {
      const body = new URLSearchParams();
      body.append("grant_type", "password");
      body.append("username", username);
      body.append("password", password);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) {
        setError("Username ya password galat hai.");
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      setToken(data.access_token);
      router.push("/dashboard");
    } catch {
      setError("Server se connect nahi ho paya. Kya backend chal raha hai?");
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell subtitle="Let's make sure it's telling the truth.">
      <AuthHeading eyebrow="Data Quality Tool" title="Welcome back" />

      <form onSubmit={handleLogin} className="flex flex-col gap-6">
        <ErrorBanner message={error} />

        <TextField
          id="username"
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="Akhilesh"
          autoComplete="username"
        />

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          below={
            <Link href="/forgot-password" className="text-[#4f2d7f] hover:underline">
              Forgot password?
            </Link>
          }
        />

        <PrimaryButton disabled={isSubmitting}>{isSubmitting ? "Logging in..." : "Log in"}</PrimaryButton>
      </form>

      <p className="text-sm text-[#5b5370]">
        New here?{" "}
        <Link href="/register" className="text-[#4f2d7f] font-bold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
