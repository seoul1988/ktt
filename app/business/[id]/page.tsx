import { supabase } from "../../../lib/supabase";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: spot } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (!spot) {
    return <div>Not found</div>;
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5">
      <img
        src={spot.image_url}
        className="w-full rounded-3xl"
      />

      <h1 className="mt-5 text-3xl font-bold">
        {spot.name}
      </h1>

      <p className="mt-2 text-gray-600">
        {spot.category}
      </p>

      <p className="mt-1">
        📍 {spot.city}
      </p>

      <div className="mt-3">
        ⭐ {spot.rating}
      </div>

      <div className="mt-5">
        {spot.tag}
      </div>

      <a
        href="/"
        className="mt-10 inline-block rounded-xl bg-black px-5 py-3 text-white"
      >
        ← Back
      </a>
    </main>
  );
}