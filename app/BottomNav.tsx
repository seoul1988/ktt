import Link from "next/link";

export default function BottomNav() {
  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-5">
      <div className="mx-auto flex max-w-md overflow-hidden rounded-full bg-[#172033] text-xs font-black text-white shadow-lg">
        <Link href="/map" className="flex-1 py-4 text-center">
          MAP
        </Link>

        <Link href="/deals" className="flex-1 py-4 text-center">
          DEALS
        </Link>

        <Link href="/community" className="flex-1 py-4 text-center">
          COMMUNITY
        </Link>

        <Link href="/profile" className="flex-1 py-4 text-center">
          PROFILE
        </Link>
      </div>
    </div>
  );
}