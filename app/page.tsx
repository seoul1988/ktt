const categories = [
  { name: "BBQ", emoji: "🍖" },
  { name: "Chicken", emoji: "🍗" },
  { name: "Cafe & Bakery", emoji: "☕" },
  { name: "Noodles", emoji: "🍜" },
  { name: "Bubble Tea", emoji: "🧋" },
];

const spots = [
  {
    name: "Seoul Garden",
    type: "Korean BBQ",
    city: "Raleigh",
    rating: "4.7",
    tag: "Popular BBQ spot",
    image: "/bbq.png",
  },
  {
    name: "KTT Bakery",
    type: "Cafe & Bakery",
    city: "Cary",
    rating: "4.6",
    tag: "Korean bakery favorite",
    image: "/bakery.png",
  },
  {
    name: "KTT Chicken",
    type: "Chicken",
    city: "Raleigh",
    rating: "4.5",
    tag: "Crispy Korean chicken",
    image: "/chicken.png",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-md px-5 pb-24 pt-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#C4483A]">KTT</p>
            <h1 className="text-3xl font-bold tracking-tight">
              KTown Triangle
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Your local K-culture guide
            </p>
          </div>

          <img
            src="/logo.png"
            alt="KTT Logo"
            className="h-16 w-16 rounded-2xl object-cover shadow-lg"
          />
        </div>

        <div className="mb-6 rounded-3xl bg-gradient-to-br from-[#C4483A] to-[#2453A6] p-5 text-white shadow-xl">
          <p className="text-sm opacity-90">Discover Triangle favorites</p>
          <h2 className="mt-2 text-2xl font-bold">
            Korean BBQ, cafes, noodles & more
          </h2>
          <button className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-bold text-[#172033]">
            Explore spots
          </button>
        </div>

        <h3 className="mb-3 text-lg font-bold">Categories</h3>
        <div className="mb-8 grid grid-cols-3 gap-3">
          {categories.map((item) => (
            <button
              key={item.name}
              className="rounded-2xl bg-white p-4 text-left shadow-sm"
            >
              <div className="text-2xl">{item.emoji}</div>
              <div className="mt-2 text-sm font-bold">{item.name}</div>
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">Trending Now</h3>
          <button className="text-sm font-bold text-[#2453A6]">See all</button>
        </div>

        <div className="space-y-4">
          {spots.map((spot) => (
            <div key={spot.name} className="rounded-3xl bg-white p-4 shadow-sm">
              <img
                src={spot.image}
                alt={spot.name}
                className="mb-4 h-36 w-full rounded-2xl object-cover"
              />

              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-bold">{spot.name}</h4>
                  <p className="text-sm text-gray-600">
                    {spot.type} · {spot.city}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#C4483A]">
                    {spot.tag}
                  </p>
                </div>

                <div className="rounded-full bg-[#F8F3EC] px-3 py-1 text-sm font-bold">
                  ★ {spot.rating}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <nav className="fixed bottom-4 left-1/2 flex w-[90%] max-w-md -translate-x-1/2 justify-around rounded-3xl bg-[#172033] px-4 py-3 text-xs font-semibold text-white shadow-2xl">
        <button>Home</button>
        <button>Map</button>
        <button>Deals</button>
        <button>Community</button>
      </nav>
    </main>
  );
}