import Image from "next/image";
import type { ReactNode } from "react";

type AuthShellProps = {
  /** Small line under the big headline on the purple panel. */
  subtitle: string;
  children: ReactNode;
};

/**
 * Shared layout for login / register / forgot-password.
 * Left  = purple panel (logo, headline, character on grey circle)
 * Right = form area (children)
 */
export default function AuthShell({ subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-screen flex font-body bg-[#faf8f5] text-[#1d1530]">
      {/* ---------- Left: purple brand panel (hidden on small screens) ---------- */}
      <section className="hidden md:block relative w-[56%] min-h-screen bg-[#4f2d7f] overflow-hidden px-12 lg:px-16 py-12">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-[10px] bg-white overflow-hidden">
            <Image src="/GT.jpg" alt="Grant Thornton logo" fill sizes="44px" style={{ objectFit: "cover" }} />
          </div>
          <span className="font-bold text-lg text-white">ClearInsight</span>
        </div>

        <div className="relative z-10 mt-20 lg:mt-24 max-w-[520px] flex flex-col gap-6">
          <div className="w-14 h-1.5 rounded-full bg-[#cbc4bc]" />
          <h1 className="font-display font-bold text-white text-5xl xl:text-[66px] leading-[1.02] tracking-[-0.03em]">
            Every dataset tells a story.
          </h1>
          <p className="text-lg xl:text-xl leading-relaxed text-white/90 max-w-[400px]">{subtitle}</p>
        </div>

        {/* grey circle + character */}
        <div className="absolute -right-[90px] -bottom-[110px] w-[460px] h-[460px] rounded-full bg-[#cbc4bc]" />
        <div className="absolute right-10 bottom-0 z-20 w-[360px] h-[470px] max-h-[62vh]">
          <Image
            src="/character.png"
            alt="ClearInsight mascot holding a laptop"
            fill
            sizes="360px"
            priority
            style={{ objectFit: "cover", objectPosition: "46% 50%" }}
          />
        </div>
      </section>

      {/* ---------- Right: form area ---------- */}
      <section className="flex-1 min-h-screen flex flex-col justify-center px-8 sm:px-16 lg:px-20 py-10">
        <div className="w-full max-w-[420px] mx-auto md:mx-0 flex flex-col gap-7">
          {/* logo row only on small screens, because the purple panel is hidden there */}
          <div className="flex items-center gap-3 md:hidden">
            <div className="relative w-10 h-10 rounded-[10px] bg-white overflow-hidden border border-[#cbc4bc]">
              <Image src="/GT.jpg" alt="Grant Thornton logo" fill sizes="40px" style={{ objectFit: "cover" }} />
            </div>
            <span className="font-bold text-[#2d1650]">ClearInsight</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
