"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const inputClass =
  "w-full h-12 bg-transparent border-0 border-b-2 border-[#cbc4bc] px-0.5 text-base text-[#1d1530] " +
  "placeholder:text-[#7a7290] focus:outline-none focus:border-[#4f2d7f] transition-colors";

const labelClass = "block text-[13px] font-semibold text-[#5b5370] mb-1";

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
};

export function TextField({ id, label, value, onChange, placeholder, type = "text", autoComplete }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClass}
      />
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  /** Optional content shown under the field (e.g. "Forgot password?" link). */
  below?: ReactNode;
};

export function PasswordField({ id, label, value, onChange, placeholder = "••••••••", autoComplete, below }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${inputClass} pr-16`}
        />
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-0 top-1/2 -translate-y-1/2 min-w-11 h-8 px-1.5 text-[13px] font-bold text-[#4f2d7f] hover:text-[#2d1650] transition-colors"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {below && <div className="mt-2 text-[13px] font-semibold">{below}</div>}
    </div>
  );
}

export function PrimaryButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full h-[54px] rounded-full bg-[#4f2d7f] text-white text-base font-bold hover:bg-[#3f2366] transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-red-700 text-sm bg-red-50 px-3 py-2 rounded-lg">
      {message}
    </p>
  );
}

export function InfoBanner({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-green-800 text-sm bg-green-50 px-3 py-2 rounded-lg">{message}</p>;
}

/** Eyebrow + serif heading used at the top of every auth form. */
export function AuthHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div>
      <div className="text-[13px] tracking-[0.15em] uppercase font-bold text-[#4f2d7f] mb-2">{eyebrow}</div>
      <h2 className="font-display font-bold text-4xl tracking-[-0.02em]">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-[#5b5370]">{subtitle}</p>}
    </div>
  );
}
