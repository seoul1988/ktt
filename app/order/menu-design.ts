type Json = Record<string, unknown>;
function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function findMenu(cells: unknown): Json | undefined {
  if (!Array.isArray(cells)) return undefined;
  for (const value of cells) {
    const cell = object(value);
    if (cell.type === "title" && cell.display_mode === "restaurant-menu") return cell;
    const nested = findMenu(cell.child_cells);
    if (nested) return nested;
  }
  return undefined;
}
export function resolveOrderDesign(sections: unknown, settings: unknown) {
  const website = object(settings);
  let source: Json = {};
  let content: Json = {};
  let width: string | undefined;
  for (const value of Array.isArray(sections) ? sections : []) {
    const section = object(value);
    if (section.is_visible === false) continue;
    const current = object(section.content);
    const layouts = Array.isArray(current.layouts) && current.layouts.length ? current.layouts : [current.grid];
    let match: Json | undefined;
    for (const layout of layouts) {
      match = findMenu(object(layout).cells);
      if (match) { width = text(object(layout).layout_width_mode); break; }
    }
    if (match || current.link_page_kind === "restaurant-menu") {
      source = match || current;
      content = current;
      if (!match) width = text(current.link_page_width);
      break;
    }
  }
  const backgroundColor = text(source.restaurant_menu_background_color) || "#ffffff";
  const menuAreaBackgroundColor = text(source.restaurant_menu_area_background_color);
  return {
    outerBackgroundColor: text(content.background_color) || text(website.outer_background_color) || menuAreaBackgroundColor || backgroundColor,
    headerBackgroundColor: text(website.header_background_color) || "#ffffff",
    widthClass: width === "full" ? "max-w-none" : width === "wide" ? "max-w-[1400px]" : "max-w-[1120px]",
    menuProps: {
      backgroundColor,
      textColor: text(source.restaurant_menu_text_color) || "#111827",
      cardBackgroundColor: text(source.restaurant_menu_card_background_color),
      cardBorderColor: text(source.restaurant_menu_card_border_color),
      nameColor: text(source.restaurant_menu_name_color),
      descriptionColor: text(source.restaurant_menu_description_color),
      priceColor: text(source.restaurant_menu_price_color),
      serviceBarBackgroundColor: text(source.restaurant_menu_service_bar_background_color),
      categoryBarBackgroundColor: text(source.restaurant_menu_category_bar_background_color),
      categoryPillBackgroundColor: text(source.restaurant_menu_category_pill_background_color),
      categoryPillTextColor: text(source.restaurant_menu_category_pill_text_color),
      categoryHeadingColor: text(source.restaurant_menu_category_heading_color),
      menuAreaBackgroundColor,
    },
  };
}
