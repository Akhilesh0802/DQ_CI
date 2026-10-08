"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

type NavbarProps =
  | { variant: "public"; authLabel: "Login" | "Register"; authHref: string }
  | { variant: "authenticated"; userName: string; userRole: string };

export default function Navbar(props: NavbarProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    setIsUserMenuOpen(false);
    router.push("/login");
  }

  return (
    <nav className="bg-[#4f2d7f] text-white px-8 py-4 flex justify-between items-center font-body">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 bg-white rounded-[10px] overflow-hidden">
          <Image src="/GT.jpg" alt="Grant Thornton logo" fill sizes="40px" style={{ objectFit: "cover" }} />
        </div>
        <span className="font-bold">ClearInsight | Data Quality Tool</span>
      </div>

      {props.variant === "public" ? (
        <div className="flex items-center gap-6 text-sm">
          <span className="text-[#cbc4bc] hidden sm:inline">Home</span>
          <span className="text-[#cbc4bc] hidden sm:inline">About us</span>
          <span className="text-[#cbc4bc] hidden sm:inline">Help</span>
          <Link
            href={props.authHref}
            className="bg-white text-[#4f2d7f] font-semibold px-5 py-2 rounded-full hover:opacity-90 transition"
          >
            {props.authLabel}
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm text-[#cbc4bc] hover:text-white transition">
            Datasets
          </Link>
          {props.userRole === "admin" && (
            <>
              <Link href="/admin/rules" className="text-sm text-[#cbc4bc] hover:text-white transition">
                Rules
              </Link>
              <Link href="/admin/audit" className="text-sm text-[#cbc4bc] hover:text-white transition">
                Audit trail
              </Link>
            </>
          )}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 text-sm text-[#cbc4bc] hover:text-white transition"
          >
            <div className="w-7 h-7 rounded-full bg-[#cbc4bc] text-[#4f2d7f] font-bold flex items-center justify-center text-xs">
              {props.userName.charAt(0).toUpperCase()}
            </div>
            {props.userName} ({props.userRole})
            <span className="text-xs">▾</span>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg overflow-hidden z-50 text-gray-700">
              <div className="px-4 py-3 border-b border-[#eee]">
                <p className="text-sm font-semibold">{props.userName}</p>
                <p className="text-xs text-gray-500">{props.userRole}</p>
              </div>
              <button onClick={() => setIsUserMenuOpen(false)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition">
                Profile
              </button>
              <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                Log out
              </button>
            </div>
          )}
        </div>
        </div>
      )}
    </nav>
  );
}