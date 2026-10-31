"use client";
import { Fragment, type ReactNode } from "react";
import type { MenuOptionGroup as MenuOptionGroupType } from "./types";
import { optionKey } from "./types";
type Props = {
  group: MenuOptionGroupType;
  groupIndex: number;
  quantities: Record<string, number>;
  onSetQuantity: (optionIndex: number, requestedQuantity: number) => void;
  renderAfterOption?: (optionIndex: number) => ReactNode;
};
function toInt(value: unknown) { return Math.max(0, Math.floor(Number(value) || 0)); }
function getRules(group: MenuOptionGroupType) {
  const name = String(group.name || "");
  const requiredMatch = name.match(/(\d+)\s*required/i);
  const maximumMatch = name.match(/(\d+)\s*maximum/i);
  const explicitMin = toInt(group.minSelect);
  const parsedMin = requiredMatch ? toInt(requiredMatch[1]) : 0;
  const minimum = explicitMin > 0 ? explicitMin : parsedMin > 0 ? parsedMin : group.required ? 1 : 0;
  const explicitMaximum = group.maxSelect == null ? null : toInt(group.maxSelect);
  const parsedMaximum = maximumMatch ? toInt(maximumMatch[1]) : null;
  let maximum = explicitMaximum != null && explicitMaximum > 0 ? explicitMaximum : parsedMaximum != null && parsedMaximum > 0 ? parsedMaximum : null;
  if (minimum === 1 && maximum == null && /\b1\s*required\b/i.test(name)) maximum = 1;
  return { minimum, maximum };
}
export default function MenuOptionGroup({group, groupIndex, quantities, onSetQuantity, renderAfterOption}: Props) {
  const {minimum, maximum} = getRules(group);
  const singleChoice = minimum === 1 && maximum === 1;
  const safeQuantities: Record<string, number> = {};
  let remaining = maximum == null ? Number.POSITIVE_INFINITY : maximum;
  group.options.forEach((option, index) => {
    const key = optionKey(option, index);
    const raw = toInt(quantities[key]);
    const requested = option.quantitySelect ? raw : Math.min(1, raw);
    const safe = option.soldOut ? 0 : Math.min(requested, remaining);
    safeQuantities[key] = safe;
    remaining = Math.max(0, remaining - safe);
  });
  const selectedCount = Object.values(safeQuantities).reduce((sum, n) => sum + n, 0);
  const maximumReached = maximum != null && selectedCount >= maximum;
  const valid = selectedCount >= minimum && (maximum == null || selectedCount <= maximum);
  const requirementText = minimum === 0 && maximum == null ? "OPTIONAL" : minimum === 0 ? `OPTIONAL (UP TO ${maximum})` : minimum === 1 && maximum === 1 ? "REQUIRED" : minimum === maximum ? `REQUIRED (SELECT ${minimum})` : maximum != null ? `REQUIRED (MIN ${minimum} · UP TO ${maximum})` : `REQUIRED (MIN ${minimum})`;
  function setQuantitySafely(index: number, value: number) {
    const option = group.options[index];
    if (!option || option.soldOut) return;
    const requested = option.quantitySelect ? toInt(value) : Math.min(1, toInt(value));
    if (singleChoice) {
      group.options.forEach((other, i) => {
        if (i !== index && toInt(safeQuantities[optionKey(other, i)]) > 0) onSetQuantity(i, 0);
      });
      onSetQuantity(index, requested > 0 ? 1 : 0);
      return;
    }
    const otherTotal = group.options.reduce((sum, other, i) => i === index ? sum : sum + toInt(safeQuantities[optionKey(other, i)]), 0);
    onSetQuantity(index, maximum == null ? requested : Math.min(requested, Math.max(0, maximum - otherTotal)));
  }
  return <section className="border-t border-black/10 pt-4">
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3 className="text-sm font-black leading-tight">{group.name}</h3>
      <span className={`shrink-0 rounded border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${minimum > 0 ? valid ? "border-red-200 bg-red-50 text-red-400" : "border-red-700 bg-red-600 text-white shadow-sm" : valid ? "border-black/20 bg-white text-black" : "border-amber-300 bg-amber-50 text-amber-800"}`}>{requirementText}</span>
    </div>
    <div className="divide-y divide-black/10">{group.options.map((option, index) => {
      const key = optionKey(option, index), quantity = toInt(safeQuantities[key]), checked = quantity > 0;
      const disabled = option.soldOut || (!checked && maximumReached && !singleChoice);
      return <Fragment key={`${groupIndex}:${key}`}>
        <div className={`flex items-center gap-3 py-3 text-sm ${option.soldOut ? "opacity-40" : ""}`}>
          <label className={`flex min-w-0 flex-1 items-center gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
            <input type={singleChoice ? "radio" : "checkbox"} name={singleChoice ? `menu-option-group-${groupIndex}` : undefined} checked={checked} disabled={disabled} onChange={event => setQuantitySafely(index, singleChoice || event.target.checked ? 1 : 0)} className="h-5 w-5 shrink-0 accent-black" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{option.name}{option.soldOut ? " · Sold Out" : ""}</span>
              {option.priceDelta !== 0 ? <span className="mt-0.5 block text-xs font-medium opacity-65">{option.priceDelta > 0 ? "+" : "-"}${Math.abs(option.priceDelta).toFixed(2)}</span> : null}
            </span>
          </label>
          {option.quantitySelect && checked ? <div className="flex shrink-0 items-center gap-2" role="group" aria-label={`${option.name} quantity`}>
            <button type="button" disabled={option.soldOut} onClick={() => setQuantitySafely(index, quantity - 1)} aria-label={`Decrease ${option.name} quantity`} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white disabled:opacity-40">−</button>
            <span className="min-w-5 text-center font-bold tabular-nums" aria-live="polite">{quantity}</span>
            <button type="button" disabled={option.soldOut || maximumReached} onClick={() => setQuantitySafely(index, quantity + 1)} aria-label={`Increase ${option.name} quantity`} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white disabled:opacity-40">+</button>
          </div> : null}
        </div>
        {renderAfterOption?.(index)}
      </Fragment>;
    })}</div>
  </section>;
}
