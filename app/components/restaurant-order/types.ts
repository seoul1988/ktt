export type MenuOptionItem = {
  name: string;
  priceDelta: number;
  soldOut: boolean;
  displayOrder: number;
  quantitySelect?: boolean;
  useSubOption?: boolean;
  subOptionGroupNo?: number | null;
};
export type MenuOptionGroup = {
  name: string;
  description?: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  displayOrder: number;
  subOptionGroupNo?: number | null;
  isSubOptionOnly?: boolean;
  options: MenuOptionItem[];
};
export type RestaurantMenuCategory = { id: number; name: string; display_order?: number | null };
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
export type RestaurantMenuPayload = { categories: RestaurantMenuCategory[]; items: RestaurantMenuItem[] };
export type OptionSelectionState = Record<string, Record<string, number>>;

/** Accept CSV/database boolean strings without treating "False" as true. */
export function isQuantitySelectEnabled(value: unknown): boolean {
  return value === true || value === 1 || (typeof value === "string" && /^(true|1|on)$/i.test(value.trim()));
}
export function getOptionGroups(item: RestaurantMenuItem | null): MenuOptionGroup[] {
  if (!item) return [];
  const rawGroups = item.option_groups || item.optionGroups || item.menu_option_groups || [];
  if (!Array.isArray(rawGroups)) return [];
  return rawGroups.map((rawGroup, groupIndex) => {
    const group = rawGroup as MenuOptionGroup & Record<string, unknown>;
    const rawOptions = Array.isArray(group.options) ? group.options : [];
    const minValue = Number(group.minSelect ?? group.min_select ?? 0);
    const maxValue = group.maxSelect ?? group.max_select;
    const maxSelect = maxValue == null || maxValue === "" ? null : Number(maxValue);
    const positiveNumber = (value: unknown) => {
      if (value == null || value === "") return null;
      const n = Number(value);
      return Number.isInteger(n) && n > 0 ? n : null;
    };
    return {
      name: String(group.name || group.group_name || `Options ${groupIndex + 1}`),
      description: String(group.description ?? group.group_description ?? group.description_text ?? "").trim(),
      required: Boolean(group.required ?? group.is_required ?? minValue > 0),
      minSelect: Number.isFinite(minValue) ? Math.max(0, Math.floor(minValue)) : 0,
      maxSelect: maxSelect != null && Number.isFinite(maxSelect) ? Math.max(0, Math.floor(maxSelect)) : null,
      displayOrder: Number(group.displayOrder ?? group.display_order ?? groupIndex) || groupIndex,
      subOptionGroupNo: positiveNumber(group.subOptionGroupNo ?? group.sub_option_group_no),
      isSubOptionOnly: Boolean(group.isSubOptionOnly ?? group.is_sub_option_only ?? false),
      options: rawOptions.map((rawOption, optionIndex) => {
        const option = rawOption as MenuOptionItem & Record<string, unknown>;
        const price = Number(option.priceDelta ?? option.price_delta ?? option.price ?? 0);
        return {
          name: String(option.name || option.option_name || `Option ${optionIndex + 1}`),
          priceDelta: Number.isFinite(price) ? price : 0,
          soldOut: Boolean(option.soldOut ?? option.sold_out ?? false),
          quantitySelect: isQuantitySelectEnabled(option.quantitySelect ?? option.quantity_select),
          useSubOption: Boolean(option.useSubOption ?? option.use_sub_option ?? false),
          subOptionGroupNo: positiveNumber(option.subOptionGroupNo ?? option.sub_option_group_no),
          displayOrder: Number(option.displayOrder ?? option.display_order ?? optionIndex) || optionIndex,
        };
      }).sort((a, b) => a.displayOrder - b.displayOrder),
    } satisfies MenuOptionGroup;
  }).sort((a, b) => a.displayOrder - b.displayOrder);
}
export function groupKey(group: MenuOptionGroup, groupIndex: number) { return `${groupIndex}:${group.name}`; }
export function optionKey(option: MenuOptionItem, optionIndex: number) { return `${optionIndex}:${option.name}`; }
export function normalizeSelections(groups: MenuOptionGroup[], state: OptionSelectionState): OptionSelectionState {
  const result: OptionSelectionState = {};
  groups.forEach((group, groupIndex) => {
    const gKey = groupKey(group, groupIndex);
    const currentGroup = state[gKey] || {};
    let remaining = group.maxSelect == null ? Number.POSITIVE_INFINITY : group.maxSelect;
    const normalized: Record<string, number> = {};
    group.options.forEach((option, optionIndex) => {
      if (remaining <= 0 || option.soldOut) return;
      const oKey = optionKey(option, optionIndex);
      const raw = Math.max(0, Math.floor(Number(currentGroup[oKey]) || 0));
      const requested = option.quantitySelect ? raw : Math.min(1, raw);
      const allowed = Math.min(requested, remaining);
      if (allowed > 0) { normalized[oKey] = allowed; remaining -= allowed; }
    });
    if (Object.keys(normalized).length) result[gKey] = normalized;
  });
  return result;
}
