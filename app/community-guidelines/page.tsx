"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const guidelines = [
  {
    number: "01",
    title: "Be Respectful",
    description:
      "Treat other members, businesses, and organizations with courtesy. Personal attacks, threats, bullying, and harassment are not allowed.",
  },
  {
    number: "02",
    title: "No Hate Speech",
    description:
      "Content that attacks or demeans people based on race, ethnicity, nationality, religion, gender, disability, age, or other protected characteristics is prohibited.",
  },
  {
    number: "03",
    title: "Keep Information Honest",
    description:
      "Do not impersonate another person or business. Do not post intentionally false information, deceptive claims, or misleading business details.",
  },
  {
    number: "04",
    title: "No Fake Reviews",
    description:
      "Reviews must reflect genuine experiences. Coordinated reviews, paid reviews, competitor attacks, and fabricated customer experiences may be removed.",
  },
  {
    number: "05",
    title: "No Spam",
    description:
      "Repeated posts, unrelated promotions, misleading links, mass solicitation, and excessive advertising are not permitted.",
  },
  {
    number: "06",
    title: "Follow the Law",
    description:
      "Do not post illegal products, services, activities, scams, fraud, malware, or content that encourages unlawful behavior.",
  },
  {
    number: "07",
    title: "Protect Privacy",
    description:
      "Do not share another person’s private information, address, phone number, financial information, or confidential records without permission.",
  },
  {
    number: "08",
    title: "Respect Copyright",
    description:
      "Only upload photos, videos, logos, writing, and other content that you own or have permission to use.",
  },
];

export default function CommunityGuidelinesPage() {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/login");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7fb] text-[#172033]">
      {/* 배경 장식 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-28 -top-24 h-80 w-80 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute -right-28 top-40 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {/* 상단 */}
        <header className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white bg-white/90 px-4 text-sm font-extrabold text-[#172033] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            <span className="text-lg" aria-hidden="true">
              ←
            </span>
            Back
          </button>

          <Link
            href="/"
            className="rounded-full border border-white bg-white/90 px-4 py-2.5 text-sm font-black tracking-tight text-[#172033] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
          >
            KTownTriangle
          </Link>
        </header>

        {/* 메인 헤더 */}
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#14213d] via-[#1b365d] to-[#315f88] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,32,51,0.24)] sm:px-10 sm:py-12">
          <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full border border-white/10" />
          <div className="absolute -right-4 top-8 h-28 w-28 rounded-full border border-white/10" />
          <div className="absolute bottom-0 right-12 h-20 w-20 rounded-full bg-white/5 blur-xl" />

          <div className="relative max-w-3xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-blue-100">
              Community Standards
            </span>

            <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              Community Guidelines
            </h1>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-blue-100 sm:text-base">
              KTownTriangle connects neighbors, local businesses, and community
              organizations. These guidelines help keep our platform useful,
              welcoming, accurate, and safe.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-2 text-xs font-bold text-blue-100">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Last updated: July 22, 2026
            </div>
          </div>
        </section>

        {/* 안내 박스 */}
        <section className="mt-5 rounded-[26px] border border-white bg-white/90 p-5 shadow-[0_18px_55px_rgba(23,32,51,0.09)] backdrop-blur sm:p-7">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eaf2ff] text-2xl">
              🤝
            </div>

            <div>
              <h2 className="text-lg font-black text-[#172033]">
                Help us build a trusted community
              </h2>

              <p className="mt-2 text-sm font-medium leading-6 text-gray-600">
                Be helpful, be honest, and treat others with respect. Content
                that violates these standards may be removed to protect the
                community.
              </p>
            </div>
          </div>
        </section>

        {/* 가이드라인 카드 */}
        <section className="mt-5 grid gap-4 md:grid-cols-2">
          {guidelines.map((item) => (
            <article
              key={item.number}
              className="group rounded-[24px] border border-white bg-white/90 p-5 shadow-[0_12px_38px_rgba(23,32,51,0.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(23,32,51,0.12)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#172033] text-xs font-black text-white shadow-md transition group-hover:bg-[#274c77]">
                  {item.number}
                </div>

                <div>
                  <h2 className="text-lg font-black tracking-[-0.02em] text-[#172033]">
                    {item.title}
                  </h2>

                  <p className="mt-2 text-sm font-medium leading-6 text-gray-600">
                    {item.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* 리뷰 */}
        <section className="mt-5 rounded-[26px] border border-[#dce8f7] bg-[#eef5ff] p-5 sm:p-7">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
              ⭐
            </div>

            <div>
              <h2 className="text-lg font-black text-[#172033]">
                Reviews and Business Discussions
              </h2>

              <p className="mt-2 text-sm font-medium leading-6 text-[#40536d]">
                Reviews should describe genuine customer experiences. Honest
                criticism is allowed, but threats, fabricated claims,
                unsupported accusations, coordinated attacks, and paid or
                manipulated reviews may be removed.
              </p>
            </div>
          </div>
        </section>

        {/* 마켓 */}
        <section className="mt-4 rounded-[26px] border border-[#f4e4d5] bg-[#fff8f1] p-5 sm:p-7">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
              🛍️
            </div>

            <div>
              <h2 className="text-lg font-black text-[#172033]">
                Marketplace Safety
              </h2>

              <ul className="mt-3 space-y-2 text-sm font-medium leading-6 text-gray-600">
                <li className="flex gap-2">
                  <span className="font-black text-[#c87832]">•</span>
                  Describe items, prices, and conditions honestly.
                </li>

                <li className="flex gap-2">
                  <span className="font-black text-[#c87832]">•</span>
                  Do not list prohibited, stolen, counterfeit, or illegal
                  products.
                </li>

                <li className="flex gap-2">
                  <span className="font-black text-[#c87832]">•</span>
                  Use caution when meeting another user or exchanging payment.
                </li>

                <li className="flex gap-2">
                  <span className="font-black text-[#c87832]">•</span>
                  KTownTriangle is not a party to transactions between users.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 제재 */}
        <section className="mt-5 rounded-[28px] bg-[#172033] p-6 text-white shadow-[0_20px_55px_rgba(23,32,51,0.20)] sm:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                Moderation and Enforcement
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Violations may result in action
              </h2>

              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-300">
                Depending on the seriousness and frequency of a violation,
                KTownTriangle may issue a warning, remove content, reduce
                visibility, suspend an account, or permanently terminate access.
              </p>
            </div>

            <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white/10 text-4xl">
              🛡️
            </div>
          </div>
        </section>

        {/* 신고 */}
        <section className="mt-5 rounded-[26px] border border-white bg-white/90 p-6 text-center shadow-[0_14px_40px_rgba(23,32,51,0.08)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
            🚩
          </div>

          <h2 className="mt-4 text-xl font-black text-[#172033]">
            Report a Problem
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-gray-600">
            Report fraudulent, harmful, illegal, or inappropriate content
            through the available reporting tools or contact our team.
          </p>

          <a
            href="mailto:support@ktowntriangle.com"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#172033] px-6 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#274c77] hover:shadow-lg active:scale-[0.98]"
          >
            support@ktowntriangle.com
          </a>
        </section>

        {/* 다른 정책 */}
        <nav className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href="/privacy"
            className="group rounded-2xl border border-white bg-white/85 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
              Privacy
            </p>

            <p className="mt-1 font-black text-[#172033] group-hover:text-[#274c77]">
              Privacy Policy →
            </p>
          </Link>

          <Link
            href="/terms"
            className="group rounded-2xl border border-white bg-white/85 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
              Terms
            </p>

            <p className="mt-1 font-black text-[#172033] group-hover:text-[#274c77]">
              Terms of Service →
            </p>
          </Link>

          <div className="rounded-2xl border border-[#172033] bg-[#172033] p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-blue-200">
              Community
            </p>

            <p className="mt-1 font-black text-white">
              Community Guidelines
            </p>
          </div>
        </nav>

        <footer className="py-8 text-center">
          <p className="text-xs font-semibold text-gray-400">
            © 2026 KTownTriangle. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
