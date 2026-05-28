import Link from "next/link";

export default function CommunityBottomNav() {
  return (
    <nav className="fixed bottom-4 left-1/2 z-[9999] flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">
      <Link href="/">HOME</Link>

      <Link href="/community/map" className="text-[#F7B955]">
        MAP
      </Link>

      <Link href="/community">COMMUNITY</Link>
    </nav>
  );
}