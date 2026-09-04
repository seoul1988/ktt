"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import MenuOptionGroup from "./MenuOptionGroup";
import type { OptionSelectionState, RestaurantMenuItem } from "./types";
import { getOptionGroups, groupKey, optionKey } from "./types";

export type MenuOrderDraft = {
  item: RestaurantMenuItem;
  quantity: number;
  instructions: string;
  selections: OptionSelectionState;
  unitPrice: number;
  totalPrice: number;
};

type Props = {
  item: RestaurantMenuItem;
  backgroundColor: string;
  textColor: string;
  orderEnabled?: boolean;
  onAddToOrder?: (draft: MenuOrderDraft) => void;
  onClose: () => void;
};

function toSafeInteger(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function getGroupRules(group: ReturnType<typeof getOptionGroups>[number]) {
  const name = String(group.name || "");

  const requiredMatch = name.match(/(\d+)\s*required/i);
  const maximumMatch = name.match(/(\d+)\s*maximum/i);

  const explicitMin = toSafeInteger(group.minSelect);
  const parsedMin = requiredMatch ? toSafeInteger(requiredMatch[1]) : 0;

  const minimum =
    explicitMin > 0
      ? explicitMin
      : parsedMin > 0
        ? parsedMin
        : group.required
          ? 1
          : 0;

  const explicitMaximum =
    group.maxSelect == null
      ? null
      : toSafeInteger(group.maxSelect);

  const parsedMaximum =
    maximumMatch
      ? toSafeInteger(maximumMatch[1])
      : null;

  const maximum =
    explicitMaximum != null && explicitMaximum > 0
      ? explicitMaximum
      : parsedMaximum != null && parsedMaximum > 0
        ? parsedMaximum
        : null;

  return { minimum, maximum };
}

function getGroupMaximum(group: ReturnType<typeof getOptionGroups>[number]) {
  return getGroupRules(group).maximum;
}

function getRawGroupDescription(
  item: RestaurantMenuItem,
  groupIndex: number,
) {
  const rawItem = item as RestaurantMenuItem & {
    option_groups?: Array<{ description?: string | null }>;
    optionGroups?: Array<{ description?: string | null }>;
    menu_option_groups?: Array<{ description?: string | null }>;
  };

  const rawGroups =
    rawItem.option_groups ??
    rawItem.optionGroups ??
    rawItem.menu_option_groups ??
    [];

  return String(rawGroups[groupIndex]?.description || "").trim();
}

function normalizeSelections(
  groups: ReturnType<typeof getOptionGroups>,
  source: OptionSelectionState,
): OptionSelectionState {
  const result: OptionSelectionState = {};

  groups.forEach((group, groupIndex) => {
    const gKey = groupKey(group, groupIndex);
    const rawGroup = source[gKey] || {};
    const maximum = getGroupMaximum(group);

    let remaining =
      maximum == null ? Number.POSITIVE_INFINITY : maximum;

    const nextGroup: Record<string, number> = {};

    group.options.forEach((option, optionIndex) => {
      if (option.soldOut || remaining <= 0) return;

      const oKey = optionKey(option, optionIndex);
      const requested = toSafeInteger(rawGroup[oKey]);

      const allowed =
        maximum == null
          ? requested
          : Math.min(requested, Math.max(0, remaining));

      if (allowed > 0) {
        nextGroup[oKey] = allowed;

        if (maximum != null) {
          remaining = Math.max(0, remaining - allowed);
        }
      }
    });

    if (Object.keys(nextGroup).length > 0) {
      result[gKey] = nextGroup;
    }
  });

  return result;
}

function selectionStatesEqual(
  a: OptionSelectionState,
  b: OptionSelectionState,
) {
  const aGroups = Object.keys(a);
  const bGroups = Object.keys(b);

  if (aGroups.length !== bGroups.length) return false;

  for (const gKey of aGroups) {
    const aGroup = a[gKey] || {};
    const bGroup = b[gKey] || {};

    const aKeys = Object.keys(aGroup);
    const bKeys = Object.keys(bGroup);

    if (aKeys.length !== bKeys.length) return false;

    for (const oKey of aKeys) {
      if (toSafeInteger(aGroup[oKey]) !== toSafeInteger(bGroup[oKey])) {
        return false;
      }
    }
  }

  return true;
}

export default function MenuItemModal({
  item,
  backgroundColor,
  textColor,
  orderEnabled = false,
  onAddToOrder,
  onClose,
}: Props) {
  const groups = useMemo(() => getOptionGroups(item), [item]);

  // 이 state 자체가 항상 그룹 maximum 안에 있도록 유지한다.
  const [selections, setSelections] = useState<OptionSelectionState>({});
  const [menuQuantity, setMenuQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [originalImageOpen, setOriginalImageOpen] = useState(false);

  // Combo It! 그룹만 기본 접힘으로 표시합니다.
  // REQUIRED 그룹과 나머지 OPTION 그룹은 기존처럼 항상 펼쳐진 상태를 유지합니다.
  const [comboItOpen, setComboItOpen] = useState(false);

  /*
   * Fast Refresh, 이전 코드, 오래된 state 등으로
   * 4 maximum 그룹 안에 8/9 같은 값이 남아 있어도 즉시 정리한다.
   *
   * 예:
   * max 4
   * { cucumber: 9 } -> { cucumber: 4 }
   * { cucumber: 3, ranch: 3 } -> { cucumber: 3, ranch: 1 }
   */
  useEffect(() => {
    setSelections((current) => {
      const normalized = normalizeSelections(groups, current);

      return selectionStatesEqual(current, normalized)
        ? current
        : normalized;
    });
  }, [groups]);

  function setOptionQuantity(
    groupIndex: number,
    optionIndex: number,
    requestedQuantity: number,
  ) {
    const group = groups[groupIndex];
    const option = group?.options?.[optionIndex];

    if (!group || !option || option.soldOut) return;

    const gKey = groupKey(group, groupIndex);
    const oKey = optionKey(option, optionIndex);
    const maximum = getGroupMaximum(group);
    const requested = toSafeInteger(requestedQuantity);

    setSelections((current) => {
      /*
       * 먼저 현재 state 전체를 정상화한다.
       * 이미 8/9 같은 잘못된 값이 있다면 이 시점에서 제거된다.
       */
      const normalizedCurrent = normalizeSelections(groups, current);
      const currentGroup = normalizedCurrent[gKey] || {};

      /*
       * 변경하려는 옵션을 제외한 "다른 옵션들의 총 수량".
       */
      const otherTotal = group.options.reduce(
        (sum, otherOption, otherIndex) => {
          if (otherIndex === optionIndex) return sum;

          const otherKey = optionKey(otherOption, otherIndex);

          return sum + toSafeInteger(currentGroup[otherKey]);
        },
        0,
      );

      /*
       * 그룹 max가 4라면:
       *
       * 다른 옵션 합계 0 -> 현재 옵션 최대 4
       * 다른 옵션 합계 1 -> 현재 옵션 최대 3
       * 다른 옵션 합계 3 -> 현재 옵션 최대 1
       * 다른 옵션 합계 4 -> 현재 옵션 최대 0
       */
      const availableForThisOption =
        maximum == null
          ? Number.POSITIVE_INFINITY
          : Math.max(0, maximum - otherTotal);

      const allowedQuantity =
        maximum == null
          ? requested
          : Math.min(requested, availableForThisOption);

      const nextGroup: Record<string, number> = {
        ...currentGroup,
      };

      if (allowedQuantity > 0) {
        nextGroup[oKey] = allowedQuantity;
      } else {
        delete nextGroup[oKey];
      }

      const next: OptionSelectionState = {
        ...normalizedCurrent,
      };

      if (Object.keys(nextGroup).length > 0) {
        next[gKey] = nextGroup;
      } else {
        delete next[gKey];
      }

      /*
       * 마지막으로 한 번 더 전체 그룹을 normalize.
       * 어떠한 호출 경로에서도 maximum 초과 state가 저장되지 않는다.
       */
      return normalizeSelections(groups, next);
    });
  }

  /*
   * 렌더링, 가격 계산, validation 모두 같은 normalized state 사용.
   * 화면 숫자와 실제 주문 state가 서로 달라지는 것을 막는다.
   */
  const safeSelections = useMemo(
    () => normalizeSelections(groups, selections),
    [groups, selections],
  );

  const optionExtra = groups.reduce(
    (groupTotal, group, groupIndex) => {
      const values =
        safeSelections[groupKey(group, groupIndex)] || {};

      return (
        groupTotal +
        group.options.reduce(
          (optionTotal, option, optionIndex) => {
            const quantity = toSafeInteger(
              values[optionKey(option, optionIndex)],
            );

            return (
              optionTotal +
              quantity * Number(option.priceDelta || 0)
            );
          },
          0,
        )
      );
    },
    0,
  );

  const optionsValid = groups.every((group, groupIndex) => {
    const values =
      safeSelections[groupKey(group, groupIndex)] || {};

    const count = group.options.reduce(
      (sum, option, optionIndex) =>
        sum +
        toSafeInteger(
          values[optionKey(option, optionIndex)],
        ),
      0,
    );

    const { minimum, maximum } = getGroupRules(group);

    return (
      count >= minimum &&
      (maximum == null || count <= maximum)
    );
  });

  const unitPrice = Math.max(
    0,
    Number(item.price || 0) + optionExtra,
  );

  const totalPrice =
    unitPrice * Math.max(1, menuQuantity);

  function handleAddToOrder() {
    if (!orderEnabled || !optionsValid) return;

    onAddToOrder?.({
      item,
      quantity: Math.max(1, menuQuantity),
      instructions: instructions.trim(),
      selections: safeSelections,
      unitPrice,
      totalPrice,
    });
  }

  const addButtonDisabled = !orderEnabled || !optionsValid;

  /*
   * 화면 표시 순서만 정리합니다.
   * 실제 groups 배열의 index는 그대로 보존해야 selections / validation / 가격 계산이
   * 기존과 동일하게 동작하므로 originalIndex를 함께 들고 정렬합니다.
   *
   * 표시 순서:
   * 1) REQUIRED 그룹
   * 2) Combo It!
   * 3) 나머지 OPTION 그룹
   */
  const displayGroups = useMemo(
    () =>
      groups
        .map((group, originalIndex) => ({
          group,
          originalIndex,
          isRequired: getGroupRules(group).minimum > 0,
          isComboIt: /\bcombo\s*it!?\b/i.test(String(group.name || "").trim()),
        }))
        .sort((a, b) => {
          const rank = (row: {
            isRequired: boolean;
            isComboIt: boolean;
          }) => {
            if (row.isRequired) return 0;
            if (row.isComboIt) return 1;
            return 2;
          };

          const rankDifference = rank(a) - rank(b);
          return rankDifference !== 0
            ? rankDifference
            : a.originalIndex - b.originalIndex;
        }),
    [groups],
  );

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 pt-10 pb-4 px-2 sm:pt-12 sm:pb-6 sm:px-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:w-[400px] sm:max-w-[400px] sm:rounded-3xl"
          style={{ backgroundColor, color: textColor, transform: "translateY(18px)" }}
          onClick={(event) => event.stopPropagation()}
        >
          {item.image_url || item.thumbnail_url ? (
            <button
              type="button"
              className="relative flex h-[190px] w-full shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-t-3xl bg-white p-2 sm:h-[210px]"
              onClick={() => setOriginalImageOpen(true)}
              aria-label={`${item.name} 이미지 View Larger`}
            >
              <img
                src={
                  item.image_url ||
                  item.thumbnail_url ||
                  ""
                }
                alt={item.name}
                draggable={false}
                className="block h-full w-full select-none object-contain transition-transform duration-200 hover:scale-[1.02]"
              />

              <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-black text-white shadow-lg">
                View Larger
              </span>
            </button>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-black leading-tight sm:text-xl">
                {item.name}
              </h2>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-black text-black"
                aria-label="Close menu details"
              >
                ×
              </button>
            </div>

            {item.price != null ? (
              <p className="mt-1 text-[15px] font-black">
                ${Number(item.price).toFixed(2)}
              </p>
            ) : null}

            {item.description ? (
              <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-6 opacity-70">
                {item.description}
              </p>
            ) : null}

            {groups.length ? (
              <div className="mt-6 space-y-5">
                {displayGroups.map(
                  ({
                    group,
                    originalIndex,
                    isComboIt,
                  }) => {
                    const gKey = groupKey(
                      group,
                      originalIndex,
                    );
                    const { maximum } = getGroupRules(group);
                    const groupDescription = getRawGroupDescription(
                      item,
                      originalIndex,
                    );

                    // Combo It!만 기본 접힘 + 버튼 클릭 시 펼침
                    if (isComboIt) {
                      return (
                        <div
                          key={gKey}
                          className="rounded-2xl border border-amber-300 bg-amber-50/70 p-2.5"
                        >
                          {!comboItOpen ? (
                            <button
                              type="button"
                              onClick={() => setComboItOpen(true)}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-amber-400 bg-amber-300 px-4 py-3 text-left text-gray-950 shadow-sm transition hover:bg-amber-400 active:scale-[0.99]"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-black">
                                  {group.name}
                                </span>
                                {groupDescription ? (
                                  <span className="mt-1 block whitespace-normal text-[11px] font-bold leading-4 text-gray-700">
                                    {groupDescription}
                                  </span>
                                ) : null}
                                <span className="mt-1 block text-[10px] font-black uppercase tracking-wide opacity-70">
                                  {maximum != null
                                    ? `OPTIONAL · UP TO ${maximum}`
                                    : "OPTIONAL"}
                                </span>
                              </span>

                              <span className="shrink-0 rounded-full bg-gray-950 px-3 py-1.5 text-[10px] font-black text-white">
                                VIEW OPTIONS ▼
                              </span>
                            </button>
                          ) : (
                            <>
                              <div className="mb-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setComboItOpen(false)}
                                  className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-[10px] font-black text-gray-800 shadow-sm"
                                >
                                  CLOSE COMBO ▲
                                </button>
                              </div>

                              {groupDescription ? (
                                <p className="mb-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold leading-5 text-gray-700">
                                  {groupDescription}
                                </p>
                              ) : null}

                              <MenuOptionGroup
                                group={group}
                                groupIndex={originalIndex}
                                quantities={
                                  safeSelections[gKey] || {}
                                }
                                onSetQuantity={(
                                  optionIndex,
                                  quantity,
                                ) =>
                                  setOptionQuantity(
                                    originalIndex,
                                    optionIndex,
                                    quantity,
                                  )
                                }
                              />
                            </>
                          )}
                        </div>
                      );
                    }

                    // REQUIRED와 기타 OPTION 그룹은 기존 방식 그대로 항상 펼쳐서 표시
                    return (
                      <div key={gKey}>
                        {groupDescription ? (
                          <p className="mb-2 rounded-xl bg-black/[0.035] px-3 py-2 text-xs font-bold leading-5 opacity-75">
                            {groupDescription}
                          </p>
                        ) : null}

                        <MenuOptionGroup
                          group={group}
                          groupIndex={originalIndex}
                          quantities={
                            safeSelections[gKey] || {}
                          }
                          onSetQuantity={(
                            optionIndex,
                            quantity,
                          ) =>
                            setOptionQuantity(
                              originalIndex,
                              optionIndex,
                              quantity,
                            )
                          }
                        />
                      </div>
                    );
                  },
                )}
              </div>
            ) : null}

            {orderEnabled ? (
              <div className="mt-5 border-t border-black/10 pt-4">
                <label className="text-xs font-black uppercase tracking-wide opacity-60">
                  Special Instructions
                </label>

                <textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Add special instructions"
                  className="mt-2 w-full resize-none rounded-xl border border-black/15 bg-transparent px-3 py-2 text-sm outline-none"
                />
              </div>
            ) : null}

          </div>

          {orderEnabled ? (
          <div
            className="z-20 flex min-h-14 shrink-0 items-stretch border-t border-black/10 shadow-[0_-8px_24px_rgba(0,0,0,0.10)]"
            style={{ backgroundColor }}
          >
            <div className="flex shrink-0 items-center border-r border-black/10">
              <button
                type="button"
                onClick={() =>
                  setMenuQuantity((value) =>
                    Math.max(1, value - 1),
                  )
                }
                className="flex h-14 w-11 items-center justify-center text-lg font-black"
              >
                −
              </button>

              <div className="flex h-14 min-w-9 items-center justify-center text-sm font-black">
                {menuQuantity}
              </div>

              <button
                type="button"
                onClick={() =>
                  setMenuQuantity((value) =>
                    Math.min(99, value + 1),
                  )
                }
                className="flex h-14 w-11 items-center justify-center text-lg font-black"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={addButtonDisabled}
              onClick={handleAddToOrder}
              className={`flex min-w-0 flex-1 items-center justify-between gap-3 px-4 text-left font-black transition ${
                addButtonDisabled
                  ? "cursor-not-allowed bg-gray-400 text-white"
                  : "cursor-pointer bg-green-600 text-white hover:bg-green-700 active:bg-green-800"
              }`}
              title={
                !orderEnabled
                  ? "Ordering is available only on the Order page."
                  : optionsValid
                    ? "Add the selected item and options to your order"
                    : "Please complete the required option selections"
              }
            >
              <span className="shrink-0">
                Add to order
              </span>

              <span className="min-w-0 text-right">
                <span className="block text-base">
                  ${totalPrice.toFixed(2)}
                </span>

                {optionExtra !== 0 ? (
                  <span className="block text-[10px] font-bold opacity-90">
                    Item ${Number(item.price || 0).toFixed(2)} + Options ${optionExtra.toFixed(2)} × {menuQuantity}
                  </span>
                ) : null}
              </span>
            </button>
          </div>
          ) : null}
        </div>
      </div>

      {originalImageOpen ? (
        <div
          className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/95 p-3 sm:p-6"
          onClick={() =>
            setOriginalImageOpen(false)
          }
        >
          <button
            type="button"
            onClick={() =>
              setOriginalImageOpen(false)
            }
            className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[13010] flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black text-black shadow-2xl"
            aria-label="Close enlarged image"
          >
            ×
          </button>

          <img
            src={
              item.image_url ||
              item.thumbnail_url ||
              ""
            }
            alt={`${item.name} enlarged image`}
            draggable={false}
            className="max-h-[92vh] max-w-[94vw] select-none object-contain"
            onClick={(event) =>
              event.stopPropagation()
            }
          />
        </div>
      ) : null}
    </>,
    document.body,
  );
}