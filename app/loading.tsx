export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC]">
      <div className="flex flex-col items-center">
        <img
          src="/icon-512.png"
          alt="KTown Triangle"
          className="h-24 w-24 rounded-3xl"
        />

        <p className="mt-4 text-sm font-bold tracking-wide text-[#172033]">
          KTown Triangle
        </p>

        <p className="mt-1 text-xs font-medium text-gray-500">
          Events, deals & Korean spots near you
        </p>
      </div>
    </main>
  );
}