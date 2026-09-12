export type MenuOptionItem = {
  name: string;
  priceDelta: number;
  soldOut: boolean;
  displayOrder: number;
  /** 선택 시 연결된 서브옵션 그룹을 펼칠지 여부 */
  useSubOption?: boolean;
  /** 연결할 서브옵션 그룹 번호 */
  subOptionGroupNo?: number | null;
};

export type MenuOptionGroup = {
  name: string;
  /** 주문 화면에 표시할 옵션 그룹 설명 */
  description?: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  displayOrder: number;
  /** 다른 옵션에서 참조할 수 있는 서브옵션 그룹 번호 */
  subOptionGroupNo?: number | null;
  /** true면 부모 옵션이 선택됐을 때만 표시 */
  isSubOptionOnly?: boolean;
  options: MenuOptionItem[];
};

export type RestaurantMenuCategory = {
  id: number;
  name: string;
  display_order?: number | null;
};

export type RestaurantMenuItem = {
  id: number;
  category_id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  thumbnail_url?: string | null;
  image_url?: string | null;
  display_order?: number | null;
  option_groups?: MenuOptionGroup[] | null;
  optionGroups?: MenuOptionGroup[] | null;
  menu_option_groups?: MenuOptionGroup[] | null;
};

export type RestaurantMenuPayload = {
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
};

export type OptionSelectionState = Record<string, Record<string, number>>;

export function getOptionGroups(item: RestaurantMenuItem | null): MenuOptionGroup[] {
  if (!item) return [];
  const rawGroups = item.option_groups || item.optionGroups || item.menu_option_groups || [];
  if (!Array.isArray(rawGroups)) return [];

  return rawGroups
    .map((rawGroup, groupIndex) => {
      const group = rawGroup as MenuOptionGroup & Record<string, unknown>;
      const rawOptions = Array.isArray(group.options) ? group.options : [];
      const minValue = Number(group.minSelect ?? group.min_select ?? 0);
      const maxValue = group.maxSelect ?? group.max_select;
      const maxSelect = maxValue == null || maxValue === "" ? null : Number(maxValue);

      return {
        name: String(group.name || group.group_name || `Options ${groupIndex + 1}`),
        description: String(
          group.description ??
          group.group_description ??
          group.description_text ??
          "",
        ).trim(),
        required: Boolean(group.required ?? group.is_required ?? minValue > 0),
        minSelect: Number.isFinite(minValue) ? Math.max(0, Math.floor(minValue)) : 0,
        maxSelect:
          maxSelect != null && Number.isFinite(maxSelect)
            ? Math.max(0, Math.floor(maxSelect))
            : null,
        displayOrder: Number(group.displayOrder ?? group.display_order ?? groupIndex) || groupIndex,
        subOptionGroupNo: (() => {
          const value =
            group.subOptionGroupNo ??
            group.sub_option_group_no;

          if (value == null || value === "") return null;

          const numberValue = Number(value);

          return Number.isInteger(numberValue) && numberValue > 0
            ? numberValue
            : null;
        })(),
        isSubOptionOnly: Boolean(
          group.isSubOptionOnly ??
          group.is_sub_option_only ??
          false,
        ),
        options: rawOptions
          .map((rawOption, optionIndex) => {
            const option = rawOption as MenuOptionItem & Record<string, unknown>;
            const price = Number(option.priceDelta ?? option.price_delta ?? option.price ?? 0);
            return {
              name: String(option.name || option.option_name || `Option ${optionIndex + 1}`),
              priceDelta: Number.isFinite(price) ? price : 0,
              soldOut: Boolean(option.soldOut ?? option.sold_out ?? false),
              useSubOption: Boolean(
                option.useSubOption ??
                option.use_sub_option ??
                false,
              ),
              subOptionGroupNo: (() => {
                const value =
                  option.subOptionGroupNo ??
                  option.sub_option_group_no;

                if (value == null || value === "") return null;

                const numberValue = Number(value);

                return Number.isInteger(numberValue) && numberValue > 0
                  ? numberValue
                  : null;
              })(),
              displayOrder:
                Number(option.displayOrder ?? option.display_order ?? optionIndex) || optionIndex,
            };
          })
          .sort((a, b) => a.displayOrder - b.displayOrder),
      } satisfies MenuOptionGroup;
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function groupKey(group: MenuOptionGroup, groupIndex: number) {
  return `${groupIndex}:${group.name}`;
}

export function optionKey(option: MenuOptionItem, optionIndex: number) {
  return `${optionIndex}:${option.name}`;
}

/**
 * 그룹 전체 합계가 maxSelect를 절대로 넘지 않도록 상태를 정규화합니다.
 * 같은 옵션 3개 + 다른 옵션 1개처럼 중복 수량 선택은 허용합니다.
 */
export function normalizeSelections(
  groups: MenuOptionGroup[],
  state: OptionSelectionState,
): OptionSelectionState {
  const result: OptionSelectionState = {};

  groups.forEach((group, groupIndex) => {
    const gKey = groupKey(group, groupIndex);
    const currentGroup = state[gKey] || {};
    const max = group.maxSelect == null ? Number.POSITIVE_INFINITY : group.maxSelect;
    let remaining = max;
    const normalized: Record<string, number> = {};

    group.options.forEach((option, optionIndex) => {
      if (remaining <= 0 || option.soldOut) return;
      const oKey = optionKey(option, optionIndex);
      const requested = Math.max(0, Math.floor(Number(currentGroup[oKey]) || 0));
      const allowed = Math.min(requested, remaining);
      if (allowed > 0) {
        normalized[oKey] = allowed;
        remaining -= allowed;
      }
    });

    if (Object.keys(normalized).length) result[gKey] = normalized;
  });

  return result;
}
