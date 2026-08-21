export const CATERING_CATEGORY_PRESETS = [
  "Party Trays",
  "Catering Packages",
  "Boxed Meals",
  "Appetizers",
  "Entrees",
  "BBQ & Grilled",
  "Chicken & Wings",
  "Burgers & Sandwiches",
  "Rice & Noodles",
  "Soups & Stews",
  "Seafood",
  "Sushi & Rolls",
  "Tacos & Mexican",
  "Pizza & Pasta",
  "Salads",
  "Vegetarian & Vegan",
  "Breakfast & Brunch",
  "Kids Meals",
  "Sides",
  "Sauces & Extras",
  "Desserts",
  "Drinks",
] as const;

export type CateringCategoryPreset =
  (typeof CATERING_CATEGORY_PRESETS)[number];