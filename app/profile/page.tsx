<label className="block">
  <span className="mb-2 block text-sm font-bold text-gray-700">
    Business Name
  </span>

  <input
    value={businessName}
    onChange={(e) => setBusinessName(e.target.value)}
    placeholder="Your business name"
    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 outline-none focus:border-[#172033]"
  />
</label>

{profile?.role === "user" &&
 profile?.owner_status !== "pending" && (

  <button
    onClick={applyOwner}
    className="
      mb-4
      w-full
      rounded-2xl
      border-2
      border-[#172033]
      py-4
      font-extrabold
      text-[#172033]
    "
  >
    Apply as Business Owner
  </button>

)}

{profile?.owner_status === "pending" && (

  <div
    className="
      mb-4
      rounded-2xl
      bg-yellow-50
      p-4
      text-sm
      font-bold
      text-yellow-700
    "
  >
    Owner application pending approval
  </div>

)}

<button
  onClick={saveProfile}
  disabled={saving}
  className="
    w-full
    rounded-2xl
    bg-[#172033]
    py-4
    text-lg
    font-extrabold
    text-white
    shadow-lg
    disabled:opacity-60
  "
>
  {saving ? "Saving..." : "Save Profile"}
</button>