"use client";

import type { MenuOptionGroup as MenuOptionGroupType } from "./types";
import { optionKey } from "./types";

type Props = {
  group: MenuOptionGroupType;
  groupIndex: number;
  quantities: Record<string, number>;
  onSetQuantity: (optionIndex: number, requestedQuantity: number) => void;
};

function toInt(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function getRules(group: MenuOptionGroupType) {
  const name = String(group.name || "");

  const requiredMatch = name.match(/(\d+)\s*required/i);
  const maximumMatch = name.match(/(\d+)\s*maximum/i);

  const explicitMin = toInt(group.minSelect);
  const parsedMin = requiredMatch ? toInt(requiredMatch[1]) : 0;

  const minimum =
    explicitMin > 0
      ? explicitMin
      : parsedMin > 0
        ? parsedMin
        : group.required
          ? 1
          : 0;

  const explicitMaximum =
    group.maxSelect == null ? null : toInt(group.maxSelect);

  const parsedMaximum =
    maximumMatch ? toInt(maximumMatch[1]) : null;

  /*
   * "1 REQUIRED"만 있고 MAXIMUM 표기가 없는 경우도
   * required single-choice 그룹으로 취급합니다.
   *
   * 예:
   * SINGLE SAUCE 1 REQUIRED
   * -> minimum 1 / maximum 1
   */
  let maximum =
    explicitMaximum != null && explicitMaximum > 0
      ? explicitMaximum
      : parsedMaximum != null && parsedMaximum > 0
        ? parsedMaximum
        : null;

  const looksLikeSingleRequired =
    minimum === 1 &&
    maximum == null &&
    /\b1\s*required\b/i.test(name);

  if (looksLikeSingleRequired) {
    maximum = 1;
  }

  return { minimum, maximum };
}

export default function MenuOptionGroup({
  group,
  groupIndex,
  quantities,
  onSetQuantity,
}: Props) {
  const { minimum, maximum } = getRules(group);

  /*
   * 정확히 1개만 선택해야 하는 그룹:
   * checkbox/수량 +/- 대신 radio UI 사용.
   *
   * 예:
   * SINGLE SAUCE 1 REQUIRED
   */
  const singleChoice = minimum === 1 && maximum === 1;

  const safeQuantities: Record<string, number> = {};
  let remaining =
    maximum == null ? Number.POSITIVE_INFINITY : maximum;

  group.options.forEach((option, optionIndex) => {
    const key = optionKey(option, optionIndex);

    if (option.soldOut || remaining <= 0) {
      safeQuantities[key] = 0;
      return;
    }

    const raw = toInt(quantities[key]);
    const safe =
      maximum == null ? raw : Math.min(raw, remaining);

    safeQuantities[key] = safe;

    if (maximum != null) {
      remaining = Math.max(0, remaining - safe);
    }
  });

  const selectedCount = group.options.reduce(
    (sum, option, optionIndex) => {
      const key = optionKey(option, optionIndex);
      return sum + toInt(safeQuantities[key]);
    },
    0,
  );

  const maximumReached =
    maximum != null && selectedCount >= maximum;

  const valid =
    selectedCount >= minimum &&
    (maximum == null || selectedCount <= maximum);

  const requirementText =
    minimum === 0 && maximum == null
      ? "OPTIONAL"
      : minimum === 0 && maximum != null
        ? `OPTIONAL (UP TO ${maximum})`
        : minimum === 1 && maximum === 1
          ? "REQUIRED"
          : minimum === maximum
            ? `REQUIRED (SELECT ${minimum})`
            : maximum != null
              ? `REQUIRED (MIN ${minimum} · UP TO ${maximum})`
              : `REQUIRED (MIN ${minimum})`;

  function setQuantitySafely(
    optionIndex: number,
    requestedQuantity: number,
  ) {
    const option = group.options[optionIndex];
    if (!option || option.soldOut) return;

    const requested = toInt(requestedQuantity);

    /*
     * Radio group:
     * 새 옵션을 고르면 부모 state에서 현재 그룹의 다른 옵션을 0으로 만들도록
     * 순서대로 callback을 호출한 뒤 선택한 옵션을 1로 설정합니다.
     */
    if (singleChoice) {
      group.options.forEach((otherOption, otherIndex) => {
        if (otherIndex === optionIndex || otherOption.soldOut) return;

        const otherKey = optionKey(otherOption, otherIndex);
        if (toInt(safeQuantities[otherKey]) > 0) {
          onSetQuantity(otherIndex, 0);
        }
      });

      onSetQuantity(optionIndex, requested > 0 ? 1 : 0);
      return;
    }

    if (maximum == null) {
      onSetQuantity(optionIndex, requested);
      return;
    }

    const otherTotal = group.options.reduce(
      (sum, otherOption, otherIndex) => {
        if (otherIndex === optionIndex) return sum;

        const otherKey = optionKey(otherOption, otherIndex);
        return sum + toInt(safeQuantities[otherKey]);
      },
      0,
    );

    const availableForThisOption = Math.max(
      0,
      maximum - otherTotal,
    );

    const allowed = Math.min(
      requested,
      availableForThisOption,
    );

    onSetQuantity(optionIndex, allowed);
  }

  return (
    <section className="border-t border-black/10 pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black leading-tight">
          {group.name}
        </h3>

        <span
          className={`shrink-0 rounded border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
            valid
              ? "border-black/20 bg-white text-black"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {requirementText}
        </span>
      </div>

      <div className="divide-y divide-black/10">
        {group.options.map((option, optionIndex) => {
          const key = optionKey(option, optionIndex);
          const quantity = toInt(safeQuantities[key]);
          const checked = quantity > 0;

          /*
           * SINGLE CHOICE
           * 두 번째 이미지처럼 radio 버튼 + 옵션명 + 가격만 표시.
           * 수량 +/-는 표시하지 않습니다.
           */
          if (singleChoice) {
            return (
              <label
                key={`${groupIndex}:${key}`}
                className={`flex cursor-pointer items-center gap-3 py-3 text-sm ${
                  option.soldOut ? "cursor-not-allowed opacity-40" : ""
                }`}
              >
                <input
                  type="radio"
                  name={`menu-option-group-${groupIndex}`}
                  checked={checked}
                  disabled={option.soldOut}
                  onChange={() => {
                    if (option.soldOut) return;
                    setQuantitySafely(optionIndex, 1);
                  }}
                  className="h-4 w-4"
                />

                <span className="min-w-0 flex-1 font-semibold">
                  {option.name}
                  {option.soldOut ? " · Sold Out" : ""}
                </span>

                <span className="shrink-0 text-xs font-bold opacity-60">
                  {option.priceDelta > 0
                    ? `+$${option.priceDelta.toFixed(2)}`
                    : option.priceDelta < 0
                      ? `-$${Math.abs(option.priceDelta).toFixed(2)}`
                      : "+$0.00"}
                </span>
              </label>
            );
          }

          const cannotSelectNew =
            option.soldOut ||
            (!checked && maximumReached);

          return (
            <label
              key={`${groupIndex}:${key}`}
              className={`flex cursor-pointer items-center gap-3 py-3 text-sm ${
                option.soldOut ? "cursor-not-allowed opacity-40" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {option.name}
                  {option.soldOut ? " · Sold Out" : ""}
                </div>
                {option.priceDelta !== 0 ? (
                  <div className="mt-0.5 text-xs font-medium opacity-65">
                    {option.priceDelta > 0
                      ? `$${option.priceDelta.toFixed(2)}`
                      : `-$${Math.abs(option.priceDelta).toFixed(2)}`}
                  </div>
                ) : null}
              </div>

              <input
                type="checkbox"
                checked={checked}
                disabled={cannotSelectNew}
                onChange={(event) => {
                  if (event.target.checked) {
                    if (maximumReached) return;
                    setQuantitySafely(optionIndex, 1);
                  } else {
                    setQuantitySafely(optionIndex, 0);
                  }
                }}
                className="h-5 w-5 shrink-0 rounded border-black/25 accent-black"
              />
            </label>
          );
        })}
      </div>


    </section>
  );
}