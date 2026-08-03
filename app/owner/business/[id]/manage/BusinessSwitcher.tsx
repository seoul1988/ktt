"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ManageableBusiness = {
  id: number;
  name: string;
};

type BusinessSwitcherProps = {
  currentBusinessId: number;
  businesses: ManageableBusiness[];
};

export default function BusinessSwitcher({
  currentBusinessId,
  businesses,
}: BusinessSwitcherProps) {
  const router = useRouter();
  const [isChanging, setIsChanging] = useState(false);

  if (businesses.length <= 1) {
    return null;
  }

  function handleChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const nextBusinessId = Number(event.target.value);

    if (
      !Number.isInteger(nextBusinessId) ||
      nextBusinessId <= 0 ||
      nextBusinessId === currentBusinessId
    ) {
      return;
    }

    setIsChanging(true);

    router.push(
      `/owner/business/${nextBusinessId}/manage`,
    );
  }

  return (
    <div className="rounded-2xl border border-[#E9DED0] bg-white p-4 shadow-sm">
      <label
        htmlFor="business-switcher"
        className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#667085]"
      >
        관리할 비즈니스 선택
      </label>

      <div className="relative">
        <select
          id="business-switcher"
          value={currentBusinessId}
          onChange={handleChange}
          disabled={isChanging}
          className="h-12 w-full appearance-none rounded-xl border border-[#D9CFC2] bg-white px-4 pr-11 text-sm font-black text-[#172033] outline-none transition focus:border-[#B64032] focus:ring-2 focus:ring-[#B64032]/10 disabled:cursor-wait disabled:opacity-60"
        >
          {businesses.map((business) => (
            <option
              key={business.id}
              value={business.id}
            >
              {business.name} (#{business.id})
            </option>
          ))}
        </select>

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#667085]">
          {isChanging ? "⏳" : "▼"}
        </span>
      </div>
    </div>
  );
}