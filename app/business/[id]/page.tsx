import { supabase } from "../../../lib/supabase";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: spot, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (!spot || error) {
    return <div>Not found</div>;
  }

console.log("CURRENT ID:", id);
console.log("CURRENT SPOT:", spot);

  return (
  <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">

    {/* Hero Image */}
    <div className="relative">
      <img
        src={spot.image_url}
        alt={spot.name}
        className="h-[320px] w-full object-cover"
      />

      <a
        href="/"
        className="absolute left-5 top-5 rounded-full bg-white/90 px-4 py-2 text-sm font-bold shadow"
      >
        ← Back
      </a>
    </div>

    <section className="px-5 py-6">

      {/* Name */}
      <h1 className="text-4xl font-extrabold">
        {spot.name}
      </h1>

      {/* Info Pills */}
      <div className="mt-5 flex flex-wrap gap-3">

        <div className="rounded-full bg-white px-4 py-2 shadow-sm">
          🍴 {spot.category}
        </div>

        <div className="rounded-full bg-white px-4 py-2 shadow-sm">
          📍 {spot.city}
        </div>

        <div className="rounded-full bg-[#172033] px-4 py-2 text-white">
          ★ {spot.rating}
        </div>

      </div>

      {/* Tag */}
      {spot.tag && (
        <div className="mt-5">
          <span className="rounded-full bg-[#C4483A] px-4 py-2 text-sm font-bold text-white">
            {spot.tag}
          </span>
        </div>
      )}

      {/* Description */}
      {spot.description && (
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">

          <h2 className="mb-4 text-xl font-bold">
            About
          </h2>

          <p className="leading-8 text-gray-700">
            {spot.description}
          </p>

        </div>
      )}

      {!spot.description && (
        <div className="mt-8 rounded-3xl bg-white p-6 text-center text-gray-500">
          No description yet.
        </div>
      )}

      {/* Action */}
      <div className="mt-10">
        <a
          href="/"
          className="block rounded-2xl bg-[#172033] py-4 text-center font-bold text-white"
        >
          Explore More Spots
        </a>
      </div>

    </section>
  </main>
);
}