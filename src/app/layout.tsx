import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillBridge AI | Your adaptive career GPS",
  description: "Build an evidence-based, adaptive path to your next career milestone.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
