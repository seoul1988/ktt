"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  updated: string;
  children: ReactNode;
};

export default function LegalPageShell({
  eyebrow,
  title,
  description,
  updated,
  children,
}: LegalPageShellProps) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-[#172033]">
      {/* 배경 장식 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#dce9ff] blur-3xl" />
        <div className="absolute -right-24 top-32 h-72 w-72 rounded-full bg-[#ffe8d8] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {/* 상단 네비게이션 */}
        <header className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/login");
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 text-sm font-bold text-[#172033] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            aria-label="Go back"
          >
            <span aria-hidden="true">←</span>
            Back
          </button>

          <Link
            href="/"
            className="rounded-full border border-white/80 bg-white/90 px-4 py-2.5 text-sm font-black tracking-tight text-[#172033] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
          >
            KTownTriangle
          </Link>
        </header>

        {/* 히어로 */}
        <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#14213d] via-[#1b365d] to-[#274c77] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,32,51,0.22)] sm:px-10 sm:py-11">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-blue-100">
              {eyebrow}
            </span>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              {title}
            </h1>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-blue-100 sm:text-base">
              {description}
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-2 text-xs font-semibold text-blue-100">
              <span aria-hidden="true">●</span>
              Last updated: {updated}
            </div>
          </div>
        </section>

        {/* 본문 */}
        <section className="mt-5 rounded-[30px] border border-white bg-white/90 p-5 shadow-[0_18px_55px_rgba(23,32,51,0.10)] backdrop-blur sm:p-9">
          <div className="legal-content">{children}</div>
        </section>

        {/* 하단 정책 네비게이션 */}
        <nav className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href="/privacy"
            className="group rounded-2xl border border-white bg-white/80 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">
              Privacy
            </p>
            <p className="mt-1 font-black group-hover:text-[#274c77]">
              Privacy Policy →
            </p>
          </Link>

          <Link
            href="/terms"
            className="group rounded-2xl border border-white bg-white/80 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">
              Terms
            </p>
            <p className="mt-1 font-black group-hover:text-[#274c77]">
              Terms of Service →
            </p>
          </Link>

          <Link
            href="/community-guidelines"
            className="group rounded-2xl border border-white bg-white/80 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">
              Community
            </p>
            <p className="mt-1 font-black group-hover:text-[#274c77]">
              Community Guidelines →
            </p>
          </Link>
        </nav>

        <footer className="py-8 text-center text-xs font-medium text-gray-400">
          © 2026 KTownTriangle. All rights reserved.
        </footer>
      </div>

      <style jsx global>{`
        .legal-content {
          color: #344054;
          font-size: 15px;
          line-height: 1.85;
        }

        .legal-content h2 {
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          color: #172033;
          font-size: 1.25rem;
          line-height: 1.35;
          font-weight: 900;
          letter-spacing: -0.025em;
        }

        .legal-content h2:first-child {
          margin-top: 0;
        }

        .legal-content h3 {
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #1b365d;
          font-size: 1rem;
          font-weight: 800;
        }

        .legal-content p {
          margin-top: 0.65rem;
        }

        .legal-content ul {
          margin-top: 0.75rem;
          display: grid;
          gap: 0.55rem;
        }

        .legal-content li {
          position: relative;
          padding-left: 1.45rem;
        }

        .legal-content li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.72rem;
          height: 0.45rem;
          width: 0.45rem;
          border-radius: 9999px;
          background: #274c77;
        }

        .legal-content .notice {
          margin-top: 1.25rem;
          border: 1px solid #dbe7f5;
          border-radius: 1.25rem;
          background: #f5f9ff;
          padding: 1rem 1.1rem;
          color: #274c77;
          font-weight: 650;
        }

        .legal-content a {
          color: #1b5fa7;
          font-weight: 750;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (min-width: 640px) {
          .legal-content {
            font-size: 16px;
          }

          .legal-content h2 {
            font-size: 1.4rem;
          }
        }
      `}</style>
    </main>
  );
}
