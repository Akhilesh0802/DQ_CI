import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Login / register / forgot-password use these two (serif headline + clean body)
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClearInsight | Data Quality Tool",
  description: "Register, profile and validate datasets — Grant Thornton ClearInsight team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${dmSans.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: Grammarly jaise browser extensions <body> mein attributes daal dete hain; sirf is element ka warning band hota hai */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
