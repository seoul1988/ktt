"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type CateringSettings = {
  is_enabled: boolean;
  page_title: string;
  page_subtitle: string | null;
  minimum_order_amount: number;
  minimum_order_people: number;
  advance_notice_hours: number;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  quote_enabled: boolean;
};

type Category = {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

type PackageRow = {
  id?: number;
  package_name: string;
  serving_label: string;
  price: string;
};

type OptionChoiceRow = {
  id?: number;
  name: string;
  description: string;
  price_delta: string;
  charge_type: "flat" | "per_person" | "per_item";
  image_url: string;
  image_path: string;
  image_file?: File | null;
  image_preview?: string;
};

type OptionGroupRow = {
  id?: number;
  name: string;
  description: string;
  selection_type: "single" | "multiple";
  min_select: string;
  max_select: string;
  choices: OptionChoiceRow[];
};

type Item = {
  id: number;
  category_id: number | null;
  name: string;
  description: string;
  image_url: string | null;
  image_path: string | null;
  pricing_type: "fixed" | "package" | "per_person" | "per_item" | "quote";
  base_price: number | null;
  minimum_quantity: number;
  advance_notice_hours: number | null;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  delivery_fee: number;
  is_active: boolean;
  packages?: Array<{
    id: number;
    package_name: string;
    serving_label: string | null;
    price: number;
  }>;
  option_groups?: Array<{
    id: number;
    name: string;
    description: string | null;
    selection_type: "single" | "multiple";
    min_select: number;
    max_select: number;
    choices: Array<{
      id: number;
      name: string;
      description: string | null;
      price_delta: number;
      charge_type: "flat" | "per_person" | "per_item";
      image_url?: string | null;
      image_path?: string | null;
    }>;
  }>;
};

type ItemForm = {
  category_id: string;
  name: string;
  description: string;
  image_url: string;
  image_path: string;
  pricing_type: Item["pricing_type"];
  base_price: string;
  minimum_quantity: string;
  advance_notice_hours: string;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  delivery_fee: string;
};

const CATERING_CATEGORY_PRESETS = [
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

const EMPTY_ITEM: ItemForm = {
  category_id: "",
  name: "",
  description: "",
  image_url: "",
  image_path: "",
  pricing_type: "fixed",
  base_price: "",
  minimum_quantity: "1",
  advance_notice_hours: "",
  pickup_enabled: true,
  delivery_enabled: false,
  delivery_fee: "0",
};

async function resizeCateringImage(
  file: File,
  maxSize = 1200,
  quality = 0.82,
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error("이미지를 읽지 못했습니다."));
        img.src = objectUrl;
      },
    );

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("이미지 크기를 확인하지 못했습니다.");
    }

    const scale = Math.min(
      1,
      maxSize / sourceWidth,
      maxSize / sourceHeight,
    );

    const width = Math.max(
      1,
      Math.round(sourceWidth * scale),
    );
    const height = Math.max(
      1,
      Math.round(sourceHeight * scale),
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("이미지를 축소하지 못했습니다.");
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        (result) => resolve(result),
        "image/webp",
        quality,
      ),
    );

    if (!blob) {
      throw new Error("이미지를 WebP로 변환하지 못했습니다.");
    }

    const baseName =
      file.name.replace(/\.[^.]+$/, "") || "catering-image";

    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function phoneHref(phone?: string | null) {
  const value = String(phone || "").trim();
  if (!value) return "";

  const normalized = value.replace(/[^0-9+]/g, "");
  return normalized ? `tel:${normalized}` : "";
}

export default function CateringManager({
  businessId,
}: {
  businessId: number;
}) {
  const [settings, setSettings] = useState<CateringSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [categoryPreset, setCategoryPreset] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryEditName, setCategoryEditName] = useState("");
  const [categoryEditDescription, setCategoryEditDescription] = useState("");
  const [categoryEditSortOrder, setCategoryEditSortOrder] = useState("0");
  const [categoryEditActive, setCategoryEditActive] = useState(true);

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>({ ...EMPTY_ITEM });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [packages, setPackages] = useState<PackageRow[]>([
    { package_name: "", serving_label: "", price: "" },
  ]);
  const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>([]);
  const [menuOptionChoices, setMenuOptionChoices] = useState<OptionChoiceRow[]>([]);

  const apiUrl = `/api/owner/business/${businessId}/catering`;

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [cateringRes, menuRes] = await Promise.all([
        fetch(apiUrl, { cache: "no-store" }),
        fetch(`/api/businesses/${businessId}/menu`, { cache: "no-store" }),
      ]);

      const cateringData = await cateringRes.json();

      if (!cateringRes.ok) {
        throw new Error(
          cateringData?.error || "캐터링 정보를 불러오지 못했습니다.",
        );
      }

      setSettings(cateringData.settings);
      setCategories(cateringData.categories || []);
      setItems(cateringData.items || []);

      if (menuRes.ok) {
        const menuData = await menuRes.json();
        const unique = new Map<string, OptionChoiceRow>();

        const menuItems = Array.isArray(menuData?.items)
          ? menuData.items
          : Array.isArray(menuData?.menu_items)
            ? menuData.menu_items
            : [];

        for (const menuItem of menuItems) {
          const rawGroups =
            menuItem?.option_groups ??
            menuItem?.optionGroups ??
            menuItem?.menu_option_groups ??
            [];

          if (!Array.isArray(rawGroups)) continue;

          for (const group of rawGroups) {
            const rawOptions = Array.isArray(group?.options)
              ? group.options
              : Array.isArray(group?.choices)
                ? group.choices
                : [];

            for (const option of rawOptions) {
              const name = String(option?.name || "").trim();
              if (!name) continue;

              const key = name.toLowerCase();
              if (unique.has(key)) continue;

              const rawPrice =
                option?.priceDelta ??
                option?.price_delta ??
                option?.price ??
                0;

              const rawDescription =
                option?.description ??
                option?.desc ??
                "";

              const rawImageUrl =
                option?.image_url ??
                option?.imageUrl ??
                option?.thumbnail_url ??
                "";

              unique.set(key, {
                name,
                description: String(rawDescription || ""),
                price_delta: String(Number(rawPrice || 0)),
                charge_type: "flat",
                image_url: String(rawImageUrl || ""),
                image_path: "",
                image_file: null,
                image_preview: String(rawImageUrl || ""),
              });
            }
          }
        }

        setMenuOptionChoices(
          Array.from(unique.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      } else {
        setMenuOptionChoices([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [businessId]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function saveSettings(patch: Partial<CateringSettings>) {
    if (!settings) return;

    const next = { ...settings, ...patch };
    setSettings(next);

    try {
      setSaving(true);
      setError("");

      const res = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settings",
          settings: next,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "설정을 저장하지 못했습니다.");
      }

      setSettings(data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정 저장 오류");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function selectExistingCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setEditingItemId(null);
    setSelectedImage(null);
    setImagePreview("");
    setPackages([
      { package_name: "", serving_label: "", price: "" },
    ]);
    setOptionGroups([]);

    if (!categoryId) {
      setCategoryEditName("");
      setCategoryEditDescription("");
      setCategoryEditSortOrder("0");
      setCategoryEditActive(true);
      setItemForm({ ...EMPTY_ITEM });
      return;
    }

    const category = categories.find(
      (row) => row.id === Number(categoryId),
    );

    if (!category) return;

    setCategoryEditName(category.name ?? "");
    setCategoryEditDescription(category.description ?? "");
    setCategoryEditSortOrder(String(category.sort_order ?? 0));
    setCategoryEditActive(Boolean(category.is_active));
    setItemForm({
      ...EMPTY_ITEM,
      category_id: categoryId,
    });
  }


  async function ensureSelectedCategory(): Promise<number> {
    if (selectedCategoryId) {
      return Number(selectedCategoryId);
    }

    const name =
      categoryPreset === "__custom__"
        ? newCategory.trim()
        : categoryPreset.trim();

    if (!name) {
      throw new Error("카테고리를 선택하거나 직접 입력하세요.");
    }

    const existing = categories.find(
      (category) =>
        category.name.trim().toLowerCase() ===
        name.toLowerCase(),
    );

    if (existing) {
      selectExistingCategory(String(existing.id));
      return existing.id;
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "category",
        category: {
          name,
          description:
            categoryEditDescription.trim() || null,
          sort_order: Math.max(
            0,
            Math.floor(
              Number(categoryEditSortOrder || categories.length),
            ),
          ),
          is_active: categoryEditActive,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error || "카테고리를 생성하지 못했습니다.",
      );
    }

    const categoryId = Number(data.category?.id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error("생성된 카테고리 정보를 확인할 수 없습니다.");
    }

    setSelectedCategoryId(String(categoryId));
    setCategoryPreset("");
    setNewCategory("");
    setCategoryEditName(data.category?.name ?? name);
    setCategoryEditDescription(
      data.category?.description ?? "",
    );
    setCategoryEditSortOrder(
      String(data.category?.sort_order ?? categories.length),
    );
    setCategoryEditActive(
      data.category?.is_active !== false,
    );
    setItemForm((prev) => ({
      ...prev,
      category_id: String(categoryId),
    }));

    return categoryId;
  }

  async function addCategory() {
    const name =
      categoryPreset === "__custom__"
        ? newCategory.trim()
        : categoryPreset.trim();

    if (!name) {
      setError("카테고리를 선택하거나 직접 입력하세요.");
      return;
    }

    const alreadyExists = categories.some(
      (category) =>
        category.name.trim().toLowerCase() ===
        name.toLowerCase(),
    );

    if (alreadyExists) {
      setError(`"${name}" 카테고리는 이미 등록되어 있습니다.`);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "category",
          category: {
            name,
            description:
              categoryEditDescription.trim() || null,
            sort_order: Math.max(
              0,
              Math.floor(
                Number(categoryEditSortOrder || categories.length),
              ),
            ),
            is_active: categoryEditActive,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "카테고리를 추가하지 못했습니다.");
      }

      setCategoryPreset("");
      setNewCategory("");

      const createdCategoryId = String(data.category?.id ?? "");
      await load();

      if (createdCategoryId) {
        setSelectedCategoryId(createdCategoryId);
        setCategoryEditName(data.category?.name ?? name);
        setCategoryEditDescription(data.category?.description ?? "");
        setCategoryEditSortOrder(String(data.category?.sort_order ?? 0));
        setCategoryEditActive(data.category?.is_active !== false);
        setItemForm({
          ...EMPTY_ITEM,
          category_id: createdCategoryId,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "카테고리 추가 오류");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(categoryId: number) {
    if (!confirm("이 카테고리를 삭제할까요? 이 카테고리의 메뉴는 삭제되지 않고 미분류로 이동합니다.")) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const res = await fetch(
        `${apiUrl}?type=category&id=${categoryId}`,
        { method: "DELETE" },
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "카테고리를 삭제하지 못했습니다.");
      }

      if (Number(selectedCategoryId) === categoryId) {
        selectExistingCategory("");
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "카테고리 삭제 오류");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedCategory() {
    const categoryId = Number(selectedCategoryId);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      setError("수정할 카테고리를 선택하세요.");
      return;
    }

    const name = categoryEditName.trim();

    if (!name) {
      setError("카테고리 이름을 입력하세요.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const res = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "category",
          category: {
            id: categoryId,
            name,
            description: categoryEditDescription.trim() || null,
            sort_order: Math.max(
              0,
              Math.floor(Number(categoryEditSortOrder || 0)),
            ),
            is_active: categoryEditActive,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "카테고리를 수정하지 못했습니다.");
      }

      await load();

      setCategoryEditName(data.category?.name ?? name);
      setCategoryEditDescription(data.category?.description ?? "");
      setCategoryEditSortOrder(String(data.category?.sort_order ?? 0));
      setCategoryEditActive(data.category?.is_active !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "카테고리 수정 오류");
    } finally {
      setSaving(false);
    }
  }

  function resetItemForm() {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setEditingItemId(null);
    setItemForm({
      ...EMPTY_ITEM,
      category_id: selectedCategoryId || "",
    });
    setSelectedImage(null);
    setImagePreview("");
    setPackages([
      { package_name: "", serving_label: "", price: "" },
    ]);
    setOptionGroups([]);
    setError("");
  }

  function editItem(item: Item) {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setEditingItemId(item.id);
    setItemForm({
      category_id: item.category_id == null ? "" : String(item.category_id),
      name: item.name ?? "",
      description: item.description ?? "",
      image_url: item.image_url ?? "",
      image_path: item.image_path ?? "",
      pricing_type: item.pricing_type,
      base_price:
        item.base_price == null ? "" : String(item.base_price),
      minimum_quantity: String(item.minimum_quantity ?? 1),
      advance_notice_hours:
        item.advance_notice_hours == null
          ? ""
          : String(item.advance_notice_hours),
      pickup_enabled: Boolean(item.pickup_enabled),
      delivery_enabled: Boolean(item.delivery_enabled),
      delivery_fee: String(item.delivery_fee ?? 0),
    });

    setSelectedImage(null);
    setImagePreview(item.image_url ?? "");

    const nextPackages =
      item.packages && item.packages.length > 0
        ? item.packages.map((pkg) => ({
            id: pkg.id,
            package_name: pkg.package_name,
            serving_label: pkg.serving_label ?? "",
            price: String(pkg.price),
          }))
        : [{ package_name: "", serving_label: "", price: "" }];

    setPackages(nextPackages);

    setOptionGroups(
      (item.option_groups ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description ?? "",
        selection_type: group.selection_type,
        min_select: String(group.min_select ?? 0),
        max_select: String(group.max_select ?? 1),
        choices: (group.choices ?? []).map((choice) => ({
          id: choice.id,
          name: choice.name,
          description: choice.description ?? "",
          price_delta: String(choice.price_delta ?? 0),
          charge_type: choice.charge_type ?? "flat",
          image_url: choice.image_url ?? "",
          image_path: choice.image_path ?? "",
          image_file: null,
          image_preview: choice.image_url ?? "",
        })),
      })),
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 선택할 수 있습니다.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("이미지는 8MB 이하로 올려주세요.");
      event.target.value = "";
      return;
    }

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  }

  async function uploadSelectedImage() {
    if (!selectedImage) {
      return {
        image_url: itemForm.image_url || null,
        image_path: itemForm.image_path || null,
      };
    }

    setUploading(true);

    try {
      const resizedImage =
        await resizeCateringImage(selectedImage);

      const formData = new FormData();
      formData.append("file", resizedImage);

      if (itemForm.image_path) {
        formData.append("old_path", itemForm.image_path);
      }

      const res = await fetch(
        `/api/owner/business/${businessId}/catering/image`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "이미지를 업로드하지 못했습니다.");
      }

      return {
        image_url: data.image_url as string,
        image_path: data.image_path as string,
      };
    } finally {
      setUploading(false);
    }
  }

  async function removeCurrentImage() {
    if (!itemForm.image_url && !selectedImage) return;

    if (!confirm("현재 이미지를 삭제할까요?")) return;

    try {
      setSaving(true);
      setError("");

      if (selectedImage && !itemForm.image_path) {
        if (imagePreview.startsWith("blob:")) {
          URL.revokeObjectURL(imagePreview);
        }
        setSelectedImage(null);
        setImagePreview("");
        return;
      }

      if (itemForm.image_path) {
        const res = await fetch(
          `/api/owner/business/${businessId}/catering/image`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_path: itemForm.image_path,
              item_id: editingItemId,
            }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "이미지를 삭제하지 못했습니다.");
        }
      }

      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      setSelectedImage(null);
      setImagePreview("");
      setItemForm((prev) => ({
        ...prev,
        image_url: "",
        image_path: "",
      }));

      if (editingItemId) {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지 삭제 오류");
    } finally {
      setSaving(false);
    }
  }

  function updatePackage(index: number, patch: Partial<PackageRow>) {
    setPackages((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addPackageRow() {
    setPackages((prev) => [
      ...prev,
      { package_name: "", serving_label: "", price: "" },
    ]);
  }

  function removePackageRow(index: number) {
    setPackages((prev) => prev.filter((_, i) => i !== index));
  }


  function addOptionGroup() {
    setOptionGroups((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        selection_type: "multiple",
        min_select: "0",
        max_select: "0",
        choices: [
          {
            name: "",
            description: "",
            price_delta: "0",
            charge_type: "flat",
            image_url: "",
            image_path: "",
            image_file: null,
            image_preview: "",
          },
        ],
      },
    ]);
  }

  function updateOptionGroup(
    groupIndex: number,
    patch: Partial<OptionGroupRow>,
  ) {
    setOptionGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex ? { ...group, ...patch } : group,
      ),
    );
  }

  function removeOptionGroup(groupIndex: number) {
    setOptionGroups((prev) =>
      prev.filter((_, index) => index !== groupIndex),
    );
  }

  function addOptionChoice(groupIndex: number) {
    setOptionGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              choices: [
                ...group.choices,
                {
                  name: "",
                  description: "",
                  price_delta: "0",
                  charge_type: "flat",
                  image_url: "",
                  image_path: "",
                  image_file: null,
                  image_preview: "",
                },
              ],
            }
          : group,
      ),
    );
  }

  function updateOptionChoice(
    groupIndex: number,
    choiceIndex: number,
    patch: Partial<OptionChoiceRow>,
  ) {
    setOptionGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              choices: group.choices.map((choice, cIndex) =>
                cIndex === choiceIndex
                  ? { ...choice, ...patch }
                  : choice,
              ),
            }
          : group,
      ),
    );
  }

  function removeOptionChoice(
    groupIndex: number,
    choiceIndex: number,
  ) {
    setOptionGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              choices: group.choices.filter(
                (_, cIndex) => cIndex !== choiceIndex,
              ),
            }
          : group,
      ),
    );
  }


  function handleOptionImageSelect(
    groupIndex: number,
    choiceIndex: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 선택할 수 있습니다.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("이미지는 8MB 이하로 올려주세요.");
      event.target.value = "";
      return;
    }

    setOptionGroups((prev) =>
      prev.map((group, gIndex) =>
        gIndex !== groupIndex
          ? group
          : {
              ...group,
              choices: group.choices.map((choice, cIndex) => {
                if (cIndex !== choiceIndex) return choice;

                if (choice.image_preview?.startsWith("blob:")) {
                  URL.revokeObjectURL(choice.image_preview);
                }

                return {
                  ...choice,
                  image_file: file,
                  image_preview: URL.createObjectURL(file),
                };
              }),
            },
      ),
    );

    setError("");
  }

  async function uploadOptionImage(
    choice: OptionChoiceRow,
  ): Promise<{
    image_url: string | null;
    image_path: string | null;
  }> {
    if (!choice.image_file) {
      return {
        image_url: choice.image_url || null,
        image_path: choice.image_path || null,
      };
    }

    const resizedImage =
      await resizeCateringImage(choice.image_file);

    const formData = new FormData();
    formData.append("file", resizedImage);

    if (choice.image_path) {
      formData.append("old_path", choice.image_path);
    }

    const res = await fetch(
      `/api/owner/business/${businessId}/catering/image`,
      {
        method: "POST",
        body: formData,
      },
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error || "옵션 이미지를 업로드하지 못했습니다.",
      );
    }

    return {
      image_url: data.image_url ?? null,
      image_path: data.image_path ?? null,
    };
  }

  async function removeOptionImage(
    groupIndex: number,
    choiceIndex: number,
  ) {
    const choice = optionGroups[groupIndex]?.choices[choiceIndex];
    if (!choice) return;

    if (!confirm("이 옵션 이미지를 삭제할까요?")) return;

    try {
      setSaving(true);
      setError("");

      if (choice.image_path) {
        const res = await fetch(
          `/api/owner/business/${businessId}/catering/image`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_path: choice.image_path,
            }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.error || "옵션 이미지를 삭제하지 못했습니다.",
          );
        }
      }

      if (choice.image_preview?.startsWith("blob:")) {
        URL.revokeObjectURL(choice.image_preview);
      }

      updateOptionChoice(groupIndex, choiceIndex, {
        image_url: "",
        image_path: "",
        image_file: null,
        image_preview: "",
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "옵션 이미지 삭제 오류",
      );
    } finally {
      setSaving(false);
    }
  }

  async function prepareOptionGroupsForSave() {
    const prepared: OptionGroupRow[] = [];

    for (const group of optionGroups) {
      const nextChoices: OptionChoiceRow[] = [];

      for (const choice of group.choices) {
        const uploaded = await uploadOptionImage(choice);

        nextChoices.push({
          ...choice,
          image_url: uploaded.image_url ?? "",
          image_path: uploaded.image_path ?? "",
          image_file: null,
          image_preview:
            uploaded.image_url ??
            choice.image_preview ??
            "",
        });
      }

      prepared.push({
        ...group,
        choices: nextChoices,
      });
    }

    setOptionGroups(prepared);
    return prepared;
  }

  async function saveItem() {
    if (!itemForm.name.trim()) {
      setError("메뉴 이름을 입력하세요.");
      return;
    }

    if (
      itemForm.pricing_type !== "quote" &&
      itemForm.pricing_type !== "package" &&
      itemForm.base_price.trim() === ""
    ) {
      setError("가격을 입력하세요.");
      return;
    }

    if (
      itemForm.pricing_type === "package" &&
      !packages.some(
        (p) => p.package_name.trim() && p.price.trim() !== "",
      )
    ) {
      setError("패키지를 하나 이상 입력하세요.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const categoryId = await ensureSelectedCategory();
      const uploadedImage = await uploadSelectedImage();
      const preparedOptionGroups =
        await prepareOptionGroupsForSave();

      const payloadItem = {
        id: editingItemId,
        category_id: categoryId,
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        image_url: uploadedImage.image_url,
        image_path: uploadedImage.image_path,
        pricing_type: itemForm.pricing_type,
        base_price:
          itemForm.pricing_type === "quote" ||
          itemForm.pricing_type === "package"
            ? null
            : Number(itemForm.base_price),
        minimum_quantity: Math.max(
          1,
          Number(itemForm.minimum_quantity || 1),
        ),
        advance_notice_hours: itemForm.advance_notice_hours
          ? Math.max(0, Number(itemForm.advance_notice_hours))
          : null,
        pickup_enabled: itemForm.pickup_enabled,
        delivery_enabled: itemForm.delivery_enabled,
        delivery_fee: itemForm.delivery_enabled
          ? Math.max(0, Number(itemForm.delivery_fee || 0))
          : 0,
      };

      const normalizedPackages =
        itemForm.pricing_type === "package"
          ? packages
              .filter(
                (p) =>
                  p.package_name.trim() &&
                  p.price.trim() !== "",
              )
              .map((p) => ({
                package_name: p.package_name.trim(),
                serving_label: p.serving_label.trim() || null,
                price: Number(p.price),
              }))
          : [];

      const normalizedOptionGroups = preparedOptionGroups
        .filter((group) => group.name.trim())
        .map((group) => {
          const choices = group.choices
            .filter((choice) => choice.name.trim())
            .map((choice) => ({
              name: choice.name.trim(),
              description: choice.description.trim() || null,
              price_delta: Math.max(
                0,
                Number(choice.price_delta || 0),
              ),
              charge_type: choice.charge_type,
              image_url: choice.image_url || null,
              image_path: choice.image_path || null,
            }));

          const minSelect = Math.max(
            0,
            Math.floor(Number(group.min_select || 0)),
          );

          let maxSelect = Math.max(
            0,
            Math.floor(Number(group.max_select || 0)),
          );

          if (group.selection_type === "single") {
            maxSelect = 1;
          } else if (maxSelect === 0) {
            maxSelect = choices.length;
          }

          if (maxSelect < minSelect) {
            maxSelect = minSelect;
          }

          return {
            name: group.name.trim(),
            description: group.description.trim() || null,
            selection_type: group.selection_type,
            min_select: minSelect,
            max_select: maxSelect,
            choices,
          };
        })
        .filter((group) => group.choices.length > 0);

      const res = await fetch(apiUrl, {
        method: editingItemId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "item",
          item: payloadItem,
          packages: normalizedPackages,
          option_groups: normalizedOptionGroups,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
            (editingItemId
              ? "캐터링 메뉴를 수정하지 못했습니다."
              : "캐터링 메뉴를 추가하지 못했습니다."),
        );
      }

      const keepCategoryId =
        selectedCategoryId || itemForm.category_id;

      resetItemForm();
      await load();

      if (keepCategoryId) {
        selectExistingCategory(String(keepCategoryId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "메뉴 저장 오류");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function deleteItem(itemId: number) {
    if (!confirm("이 캐터링 메뉴를 삭제할까요? 등록된 이미지도 함께 삭제됩니다.")) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const res = await fetch(`${apiUrl}?type=item&id=${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "메뉴를 삭제하지 못했습니다.");
      }

      if (editingItemId === itemId) {
        resetItemForm();
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "메뉴 삭제 오류");
    } finally {
      setSaving(false);
    }
  }

  const itemsByCategory = useMemo(() => {
    const map = new Map<number | null, Item[]>();

    for (const item of items) {
      const key = item.category_id ?? null;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }

    return map;
  }, [items]);

  const registeredOptionChoices = useMemo<OptionChoiceRow[]>(() => {
    const unique = new Map<string, OptionChoiceRow>();

    // 1) 일반 메뉴에 등록된 옵션을 먼저 넣습니다.
    for (const choice of menuOptionChoices) {
      const name = String(choice.name || "").trim();
      if (!name) continue;

      const key = name.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, { ...choice, name });
      }
    }

    // 2) 캐터링에만 등록된 옵션도 뒤에 합칩니다.
    for (const item of items) {
      for (const group of item.option_groups ?? []) {
        for (const choice of group.choices ?? []) {
          const name = String(choice.name || "").trim();
          if (!name) continue;

          const key = name.toLowerCase();
          if (unique.has(key)) continue;

          unique.set(key, {
            name,
            description: String(choice.description || ""),
            price_delta: String(choice.price_delta ?? 0),
            charge_type: choice.charge_type ?? "flat",
            image_url: String(choice.image_url || ""),
            image_path: String(choice.image_path || ""),
            image_file: null,
            image_preview: String(choice.image_url || ""),
          });
        }
      }
    }

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [items, menuOptionChoices]);

  function addRegisteredOptionChoice(
    groupIndex: number,
    registeredChoice: OptionChoiceRow,
  ) {
    setOptionGroups((prev) =>
      prev.map((group, index) => {
        if (index !== groupIndex) return group;

        const normalizedName = registeredChoice.name.trim().toLowerCase();
        const alreadyExists = group.choices.some(
          (choice) => choice.name.trim().toLowerCase() === normalizedName,
        );

        if (alreadyExists) return group;

        return {
          ...group,
          choices: [
            ...group.choices,
            {
              name: registeredChoice.name,
              description: registeredChoice.description,
              price_delta: registeredChoice.price_delta,
              charge_type: registeredChoice.charge_type,
              image_url: registeredChoice.image_url,
              image_path: registeredChoice.image_path,
              image_file: null,
              image_preview:
                registeredChoice.image_preview ||
                registeredChoice.image_url ||
                "",
            },
          ],
        };
      }),
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F5F0] p-6">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8">
          캐터링 정보를 불러오는 중...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F5F0] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a
              href={`/owner/business/${businessId}/manage`}
              className="text-sm font-black text-[#B64032]"
            >
              ← 관리 화면
            </a>

            <h1 className="mt-3 text-3xl font-black text-[#172033]">
              캐터링 관리
            </h1>

            <p className="mt-2 text-sm font-medium text-[#667085]">
              카테고리, 메뉴, 이미지, 패키지/사이즈와 주문 조건을 관리합니다.
            </p>
          </div>

          {(saving || uploading) && (
            <div className="text-sm font-bold text-[#667085]">
              {uploading ? "이미지 업로드 중..." : "저장 중..."}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {settings && (
          <section className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-[#172033]">
                  캐터링 사용 설정
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  주문 가능한 최소 금액과 최소 인원을 각각 설정합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void saveSettings({
                    is_enabled: !settings.is_enabled,
                  })
                }
                className={`rounded-full px-5 py-2 text-sm font-black ${
                  settings.is_enabled
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {settings.is_enabled ? "활성화 ON" : "비활성화 OFF"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-bold text-[#344054]">
                최소 주문금액 ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.minimum_order_amount}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minimum_order_amount: Number(e.target.value || 0),
                    })
                  }
                  onBlur={() =>
                    void saveSettings({
                      minimum_order_amount:
                        settings.minimum_order_amount,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
                />
              </label>

              <label className="text-sm font-bold text-[#344054]">
                최소 주문인원
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={settings.minimum_order_people}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        minimum_order_people: Number(e.target.value || 0),
                      })
                    }
                    onBlur={() =>
                      void saveSettings({
                        minimum_order_people:
                          settings.minimum_order_people,
                      })
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
                  />
                  <span className="whitespace-nowrap text-sm">명</span>
                </div>
              </label>

              <label className="text-sm font-bold text-[#344054]">
                사전 주문시간
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={settings.advance_notice_hours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        advance_notice_hours: Number(e.target.value || 0),
                      })
                    }
                    onBlur={() =>
                      void saveSettings({
                        advance_notice_hours:
                          settings.advance_notice_hours,
                      })
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
                  />
                  <span className="whitespace-nowrap text-sm">시간 전</span>
                </div>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              {[
                ["pickup_enabled", "Pickup"],
                ["delivery_enabled", "Delivery"],
                ["quote_enabled", "견적 문의"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(
                      settings[key as keyof CateringSettings],
                    )}
                    onChange={(e) =>
                      void saveSettings({
                        [key]: e.target.checked,
                      } as Partial<CateringSettings>)
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-[#172033]">
            카테고리
          </h2>

          <p className="mt-1 text-sm text-[#667085]">
            카테고리를 선택하면 바로 아래에 해당 카테고리 정보가 표시됩니다.
            등록되지 않은 종류를 선택하면 새 카테고리 정보 입력 화면이 표시됩니다.
          </p>

          <select
            value={
              selectedCategoryId
                ? `existing:${selectedCategoryId}`
                : categoryPreset
                  ? `preset:${categoryPreset}`
                  : ""
            }
            onChange={(e) => {
              const value = e.target.value;
              setError("");

              if (!value) {
                setCategoryPreset("");
                setNewCategory("");
                selectExistingCategory("");
                return;
              }

              if (value.startsWith("existing:")) {
                const id = value.replace("existing:", "");
                setCategoryPreset("");
                setNewCategory("");
                selectExistingCategory(id);
                return;
              }

              const preset = value.replace("preset:", "");
              selectExistingCategory("");
              setCategoryPreset(preset);

              const categoryName =
                preset === "__custom__" ? "" : preset;

              if (preset === "__custom__") {
                setNewCategory("");
              } else {
                setNewCategory(preset);
              }

              setCategoryEditName(categoryName);
              setCategoryEditDescription("");
              setCategoryEditSortOrder(
                String(categories.length),
              );
              setCategoryEditActive(true);

              setItemForm({
                ...EMPTY_ITEM,
                category_id: "",
              });
              setPackages([
                { package_name: "", serving_label: "", price: "" },
              ]);
              setOptionGroups([]);
            }}
            className="mt-4 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-2.5 text-sm font-bold text-[#172033]"
          >
            <option value="">카테고리 선택</option>

            {categories.length > 0 && (
              <optgroup label="등록된 카테고리">
                {categories.map((category) => (
                  <option
                    key={`existing-${category.id}`}
                    value={`existing:${category.id}`}
                  >
                    {category.name}
                    {!category.is_active ? " (숨김)" : ""}
                  </option>
                ))}
              </optgroup>
            )}

            <optgroup label="새 카테고리">
              {CATERING_CATEGORY_PRESETS.filter(
                (preset) =>
                  !categories.some(
                    (category) =>
                      category.name.trim().toLowerCase() ===
                      preset.toLowerCase(),
                  ),
              ).map((preset) => (
                <option
                  key={`preset-${preset}`}
                  value={`preset:${preset}`}
                >
                  + {preset}
                </option>
              ))}

              <option value="preset:__custom__">
                + 목록에 없음 / 직접 입력
              </option>
            </optgroup>
          </select>

          {selectedCategoryId && (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-[#E9DED0] bg-[#FFFDF9] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-[#B64032]">
                      선택된 카테고리
                    </div>
                    <div className="mt-1 text-xl font-black text-[#172033]">
                      {categoryEditName}
                    </div>
                    <div className="mt-1 text-sm text-[#667085]">
                      등록 메뉴 {(itemsByCategory.get(Number(selectedCategoryId)) ?? []).length}개
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={resetItemForm}
                    className="rounded-xl bg-[#172033] px-4 py-2.5 text-sm font-black text-white"
                  >
                    + 새 메뉴 등록
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(itemsByCategory.get(Number(selectedCategoryId)) ?? []).map(
                    (item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onEdit={editItem}
                        onDelete={deleteItem}
                      />
                    ),
                  )}

                  {(itemsByCategory.get(Number(selectedCategoryId)) ?? []).length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#D9CFC2] bg-white px-4 py-5 text-center text-sm font-bold text-[#98A2B3]">
                      이 카테고리에 등록된 메뉴가 없습니다. 아래에서 첫 메뉴를 등록하세요.
                    </div>
                  )}
                </div>
              </div>

              <details className="rounded-2xl border border-[#E9DED0] bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-black text-[#172033]">
                  카테고리 이름·설명·순서·공개상태 수정
                </summary>

                <div className="border-t border-[#EEE6DC] p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-[#344054]">
                      카테고리 이름
                      <input
                        value={categoryEditName}
                        onChange={(e) =>
                          setCategoryEditName(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-2"
                      />
                    </label>

                    <label className="text-sm font-bold text-[#344054]">
                      표시 순서
                      <input
                        type="number"
                        min="0"
                        value={categoryEditSortOrder}
                        onChange={(e) =>
                          setCategoryEditSortOrder(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-2"
                      />
                    </label>
                  </div>

                  <label className="mt-4 block text-sm font-bold text-[#344054]">
                    설명
                    <textarea
                      rows={2}
                      value={categoryEditDescription}
                      onChange={(e) =>
                        setCategoryEditDescription(e.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-2"
                    />
                  </label>

                  <label className="mt-4 flex items-center gap-2 text-sm font-bold text-[#344054]">
                    <input
                      type="checkbox"
                      checked={categoryEditActive}
                      onChange={(e) =>
                        setCategoryEditActive(e.target.checked)
                      }
                    />
                    공개 페이지에 이 카테고리 표시
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveSelectedCategory()}
                      disabled={saving}
                      className="rounded-xl bg-[#172033] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
                    >
                      카테고리 수정 저장
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteCategory(Number(selectedCategoryId))
                      }
                      disabled={saving}
                      className="rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-black text-red-600 disabled:opacity-50"
                    >
                      카테고리 삭제
                    </button>
                  </div>
                </div>
              </details>
            </div>
          )}

          {!selectedCategoryId && categoryPreset && (
            <div className="mt-4 rounded-2xl border border-[#E9DED0] bg-[#FFFDF9] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-wide text-[#B64032]">
                    새 카테고리 선택됨
                  </div>

                  {categoryPreset === "__custom__" ? (
                    <label className="mt-2 block text-sm font-bold text-[#344054]">
                      카테고리 이름
                      <input
                        autoFocus
                        value={newCategory}
                        onChange={(e) => {
                          setNewCategory(e.target.value);
                          setCategoryEditName(e.target.value);
                        }}
                        placeholder="카테고리 이름 입력"
                        className="mt-2 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-2"
                      />
                    </label>
                  ) : (
                    <div className="mt-1 text-xl font-black text-[#172033]">
                      {categoryPreset}
                    </div>
                  )}

                  <p className="mt-1 text-sm text-[#667085]">
                    아래에서 이미지, 가격, 패키지와 옵션을 입력해 첫 메뉴를 저장하면
                    이 카테고리도 자동으로 생성됩니다.
                  </p>
                </div>

                <details className="sm:w-[260px]">
                  <summary className="cursor-pointer rounded-xl border border-[#D9CFC2] bg-white px-4 py-2.5 text-center text-sm font-black text-[#172033]">
                    카테고리 세부 설정
                  </summary>

                  <div className="mt-2 rounded-xl border border-[#E9DED0] bg-white p-3">
                    <label className="block text-xs font-black text-[#475467]">
                      표시 순서
                      <input
                        type="number"
                        min="0"
                        value={categoryEditSortOrder}
                        onChange={(e) =>
                          setCategoryEditSortOrder(e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#D9CFC2] px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="mt-3 block text-xs font-black text-[#475467]">
                      설명
                      <textarea
                        rows={2}
                        value={categoryEditDescription}
                        onChange={(e) =>
                          setCategoryEditDescription(e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#D9CFC2] px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="mt-3 flex items-center gap-2 text-xs font-black text-[#475467]">
                      <input
                        type="checkbox"
                        checked={categoryEditActive}
                        onChange={(e) =>
                          setCategoryEditActive(e.target.checked)
                        }
                      />
                      공개 페이지에 표시
                    </label>
                  </div>
                </details>
              </div>
            </div>
          )}
        </section>

        {(selectedCategoryId || categoryPreset) && (
          <>
        <section className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-[#172033]">
              {editingItemId
                ? `${categoryEditName || newCategory || categoryPreset} 메뉴 수정`
                : `${categoryEditName || newCategory || categoryPreset} 메뉴 추가`}
            </h2>

            {editingItemId && (
              <button
                type="button"
                onClick={resetItemForm}
                className="rounded-xl border border-[#D9CFC2] px-4 py-2 text-sm font-black"
              >
                수정 취소
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              카테고리
              <div className="mt-2 flex h-[42px] items-center rounded-xl border border-[#D9CFC2] bg-[#F7F7F7] px-3 text-sm font-black text-[#172033]">
                {categoryEditName || newCategory || categoryPreset}
              </div>
            </label>

            <label className="text-sm font-bold">
              메뉴 이름
              <input
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    name: e.target.value,
                  })
                }
                placeholder="예: Bulgogi Party Tray"
                className="mt-2 w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-bold">
            설명
            <textarea
              value={itemForm.description}
              onChange={(e) =>
                setItemForm({
                  ...itemForm,
                  description: e.target.value,
                })
              }
              rows={3}
              className="mt-2 w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
            />
          </label>

          <div className="mt-5">
            <div className="text-sm font-black text-[#344054]">
              메뉴 이미지
            </div>

            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#D9CFC2] bg-[#FFF9F1] sm:w-56">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="캐터링 메뉴 미리보기"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center text-sm font-bold text-[#98A2B3]">
                    이미지 없음
                  </div>
                )}
              </div>

              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="block w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-2 text-sm"
                />

                <p className="mt-2 text-xs text-[#667085]">
                  JPG, PNG, WEBP 등 이미지 파일 · 최대 8MB · 저장 시 자동 축소(WebP)
                </p>

                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => void removeCurrentImage()}
                    className="mt-3 rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600"
                  >
                    이미지 삭제
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              가격 방식
              <select
                value={itemForm.pricing_type}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    pricing_type:
                      e.target.value as Item["pricing_type"],
                  })
                }
                className="mt-2 w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
              >
                <option value="fixed">고정 가격</option>
                <option value="package">사이즈 / 패키지</option>
                <option value="per_person">1인당</option>
                <option value="per_item">개당</option>
                <option value="quote">견적 문의</option>
              </select>
            </label>

            {itemForm.pricing_type !== "package" &&
              itemForm.pricing_type !== "quote" && (
                <label className="text-sm font-bold">
                  기본 가격
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.base_price}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        base_price: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
                  />
                </label>
              )}
          </div>

          {itemForm.pricing_type === "package" && (
            <div className="mt-5 rounded-2xl bg-[#FFF9F1] p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-[#172033]">
                  패키지 / 사이즈
                </h3>
                <button
                  type="button"
                  onClick={addPackageRow}
                  className="text-sm font-black text-[#B64032]"
                >
                  + 패키지 추가
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {packages.map((row, index) => (
                  <div
                    key={`${row.id ?? "new"}-${index}`}
                    className="grid gap-2 rounded-xl border border-[#E9DED0] bg-white p-3 sm:grid-cols-[1fr_1fr_140px_36px]"
                  >
                    <input
                      value={row.package_name}
                      onChange={(e) =>
                        updatePackage(index, {
                          package_name: e.target.value,
                        })
                      }
                      placeholder="Small / 50 Wings"
                      className="rounded-lg border border-[#D9CFC2] px-3 py-2"
                    />
                    <input
                      value={row.serving_label}
                      onChange={(e) =>
                        updatePackage(index, {
                          serving_label: e.target.value,
                        })
                      }
                      placeholder="Serves 6-8 / 50 Pieces"
                      className="rounded-lg border border-[#D9CFC2] px-3 py-2"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.price}
                      onChange={(e) =>
                        updatePackage(index, {
                          price: e.target.value,
                        })
                      }
                      placeholder="가격"
                      className="rounded-lg border border-[#D9CFC2] px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => removePackageRow(index)}
                      className="rounded-lg text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-[#E9DED0] bg-[#FCFBF8] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-[#172033]">
                  Add-ons / Options
                </h3>
                <p className="mt-1 text-xs text-[#667085]">
                  예: Extra Rice +$10, Sauce 선택, Cheese +$1/person, Utensils +$5
                </p>
              </div>

              <button
                type="button"
                onClick={addOptionGroup}
                className="rounded-xl bg-[#172033] px-4 py-2 text-sm font-black text-white"
              >
                + 옵션 그룹 추가
              </button>
            </div>

            {optionGroups.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[#D9CFC2] bg-white px-4 py-5 text-center text-sm font-bold text-[#98A2B3]">
                등록된 옵션이 없습니다.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {optionGroups.map((group, groupIndex) => (
                  <div
                    key={`${group.id ?? "new"}-${groupIndex}`}
                    className="rounded-2xl border border-[#E9DED0] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                        <label className="text-xs font-black text-[#475467]">
                          옵션 그룹 이름
                          <input
                            value={group.name}
                            onChange={(e) =>
                              updateOptionGroup(groupIndex, {
                                name: e.target.value,
                              })
                            }
                            placeholder="예: Sauce / Add-ons"
                            className="mt-1 w-full rounded-lg border border-[#D9CFC2] px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="text-xs font-black text-[#475467]">
                          선택 방식
                          <select
                            value={group.selection_type}
                            onChange={(e) => {
                              const nextType =
                                e.target.value as "single" | "multiple";
                              updateOptionGroup(groupIndex, {
                                selection_type: nextType,
                                max_select:
                                  nextType === "single"
                                    ? "1"
                                    : group.max_select,
                              });
                            }}
                            className="mt-1 w-full rounded-lg border border-[#D9CFC2] px-3 py-2 text-sm"
                          >
                            <option value="single">
                              하나 선택
                            </option>
                            <option value="multiple">
                              여러 개 선택
                            </option>
                          </select>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeOptionGroup(groupIndex)
                        }
                        className="rounded-lg px-2 py-1 text-lg font-black text-red-500"
                        aria-label="옵션 그룹 삭제"
                      >
                        ×
                      </button>
                    </div>

                    <label className="mt-3 block text-xs font-black text-[#475467]">
                      그룹 설명
                      <input
                        value={group.description}
                        onChange={(e) =>
                          updateOptionGroup(groupIndex, {
                            description: e.target.value,
                          })
                        }
                        placeholder="예: 원하는 소스를 선택하세요."
                        className="mt-1 w-full rounded-lg border border-[#D9CFC2] px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-black text-[#475467]">
                        최소 선택
                        <input
                          type="number"
                          min="0"
                          value={group.min_select}
                          onChange={(e) =>
                            updateOptionGroup(groupIndex, {
                              min_select: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-[#D9CFC2] px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-xs font-black text-[#475467]">
                        최대 선택
                        <input
                          type="number"
                          min="0"
                          value={
                            group.selection_type === "single"
                              ? "1"
                              : group.max_select
                          }
                          disabled={
                            group.selection_type === "single"
                          }
                          onChange={(e) =>
                            updateOptionGroup(groupIndex, {
                              max_select: e.target.value,
                            })
                          }
                          placeholder="0 = 등록된 옵션 전체"
                          className="mt-1 w-full rounded-lg border border-[#D9CFC2] px-3 py-2 text-sm disabled:bg-gray-100"
                        />
                      </label>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-black text-[#172033]">
                          선택 항목
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            addOptionChoice(groupIndex)
                          }
                          className="text-sm font-black text-[#B64032]"
                        >
                          + 항목 추가
                        </button>
                      </div>

                      {registeredOptionChoices.length > 0 && (
                        <div className="mt-3 rounded-xl border border-[#E9DED0] bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-black text-[#172033]">
                                등록된 옵션에서 선택
                              </div>
                              <div className="mt-0.5 text-[11px] font-semibold text-[#667085]">
                                일반 메뉴와 캐터링에 등록된 옵션을 이름 기준 중복 없이 보여줍니다. 클릭하면 아래 선택 항목에 추가됩니다.
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {registeredOptionChoices
                              .filter(
                                (registeredChoice) =>
                                  !group.choices.some(
                                    (choice) =>
                                      choice.name.trim().toLowerCase() ===
                                      registeredChoice.name.trim().toLowerCase(),
                                  ),
                              )
                              .map((registeredChoice) => (
                                <button
                                  key={`registered-${registeredChoice.name.toLowerCase()}`}
                                  type="button"
                                  onClick={() =>
                                    addRegisteredOptionChoice(
                                      groupIndex,
                                      registeredChoice,
                                    )
                                  }
                                  className="inline-flex items-center gap-2 rounded-full border border-[#D9CFC2] bg-[#FFF9F1] px-3 py-2 text-xs font-black text-[#172033] hover:border-[#B64032] hover:bg-[#FFF3E6]"
                                  title="이 옵션을 현재 그룹에 추가"
                                >
                                  <span>+ {registeredChoice.name}</span>
                                  {Number(registeredChoice.price_delta || 0) > 0 && (
                                    <span className="text-[#B64032]">
                                      +${Number(
                                        registeredChoice.price_delta || 0,
                                      ).toFixed(2)}
                                    </span>
                                  )}
                                </button>
                              ))}

                            {registeredOptionChoices.every((registeredChoice) =>
                              group.choices.some(
                                (choice) =>
                                  choice.name.trim().toLowerCase() ===
                                  registeredChoice.name.trim().toLowerCase(),
                              ),
                            ) && (
                              <div className="text-xs font-bold text-[#98A2B3]">
                                등록된 옵션을 모두 추가했습니다.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 space-y-2">
                        {group.choices.map(
                          (choice, choiceIndex) => (
                            <div
                              key={`${choice.id ?? "new"}-${choiceIndex}`}
                              className="rounded-xl bg-[#FFF9F1] p-3"
                            >
                              <div className="grid gap-2 lg:grid-cols-[96px_1.2fr_1fr_130px_150px_36px]">
                                <div className="flex flex-col gap-2">
                                  <div className="aspect-square w-24 overflow-hidden rounded-xl border border-dashed border-[#D9CFC2] bg-white">
                                    {choice.image_preview ||
                                    choice.image_url ? (
                                      <img
                                        src={
                                          choice.image_preview ||
                                          choice.image_url
                                        }
                                        alt={choice.name || "옵션 이미지"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] font-bold text-[#98A2B3]">
                                        이미지 없음
                                      </div>
                                    )}
                                  </div>

                                  <label className="cursor-pointer rounded-lg border border-[#D9CFC2] bg-white px-2 py-1.5 text-center text-[10px] font-black text-[#344054]">
                                    이미지 선택
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(event) =>
                                        handleOptionImageSelect(
                                          groupIndex,
                                          choiceIndex,
                                          event,
                                        )
                                      }
                                      className="hidden"
                                    />
                                  </label>

                                  {(choice.image_preview ||
                                    choice.image_url) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void removeOptionImage(
                                          groupIndex,
                                          choiceIndex,
                                        )
                                      }
                                      className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-[10px] font-black text-red-600"
                                    >
                                      이미지 삭제
                                    </button>
                                  )}
                                </div>

                              <input
                                value={choice.name}
                                onChange={(e) =>
                                  updateOptionChoice(
                                    groupIndex,
                                    choiceIndex,
                                    { name: e.target.value },
                                  )
                                }
                                placeholder="Extra Rice / BBQ Sauce"
                                className="rounded-lg border border-[#D9CFC2] bg-white px-3 py-2 text-sm"
                              />

                              <input
                                value={choice.description}
                                onChange={(e) =>
                                  updateOptionChoice(
                                    groupIndex,
                                    choiceIndex,
                                    {
                                      description:
                                        e.target.value,
                                    },
                                  )
                                }
                                placeholder="설명 (선택)"
                                className="rounded-lg border border-[#D9CFC2] bg-white px-3 py-2 text-sm"
                              />

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={choice.price_delta}
                                onChange={(e) =>
                                  updateOptionChoice(
                                    groupIndex,
                                    choiceIndex,
                                    {
                                      price_delta:
                                        e.target.value,
                                    },
                                  )
                                }
                                placeholder="추가금"
                                className="rounded-lg border border-[#D9CFC2] bg-white px-3 py-2 text-sm"
                              />

                              <select
                                value={choice.charge_type}
                                onChange={(e) =>
                                  updateOptionChoice(
                                    groupIndex,
                                    choiceIndex,
                                    {
                                      charge_type:
                                        e.target.value as
                                          | "flat"
                                          | "per_person"
                                          | "per_item",
                                    },
                                  )
                                }
                                className="rounded-lg border border-[#D9CFC2] bg-white px-3 py-2 text-sm"
                              >
                                <option value="flat">
                                  고정 추가금
                                </option>
                                <option value="per_person">
                                  1인당
                                </option>
                                <option value="per_item">
                                  개당
                                </option>
                              </select>

                              <button
                                type="button"
                                onClick={() =>
                                  removeOptionChoice(
                                    groupIndex,
                                    choiceIndex,
                                  )
                                }
                                className="rounded-lg text-red-500"
                                aria-label="옵션 항목 삭제"
                              >
                                ×
                              </button>
                              </div>

                              <p className="mt-2 text-[10px] font-semibold text-[#667085]">
                                옵션 이미지도 저장 시 자동 축소됩니다.
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              최소 주문수량
              <input
                type="number"
                min="1"
                value={itemForm.minimum_quantity}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    minimum_quantity: e.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
              />
            </label>

            <label className="text-sm font-bold">
              별도 사전 주문시간
              <input
                type="number"
                min="0"
                value={itemForm.advance_notice_hours}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    advance_notice_hours: e.target.value,
                  })
                }
                placeholder="비우면 전체 설정 사용"
                className="mt-2 w-full rounded-xl border border-[#D9CFC2] px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5">

            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={itemForm.pickup_enabled}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    pickup_enabled: e.target.checked,
                  })
                }
              />
              Pickup
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={itemForm.delivery_enabled}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      delivery_enabled: e.target.checked,
                      delivery_fee: e.target.checked
                        ? itemForm.delivery_fee
                        : "0",
                    })
                  }
                />
                Delivery
              </label>

              {itemForm.delivery_enabled ? (
                <label className="flex items-center gap-2 text-sm font-bold text-[#344054]">
                  <span>Delivery Fee $</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.delivery_fee}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        delivery_fee: e.target.value,
                      })
                    }
                    placeholder="0.00"
                    className="w-28 rounded-xl border border-[#D9CFC2] bg-white px-3 py-2"
                  />
                </label>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void saveItem()}
            disabled={saving || uploading}
            className="mt-5 rounded-xl bg-[#B64032] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {editingItemId ? "수정 저장" : "캐터링 메뉴 저장"}
          </button>
        </section>
          </>
        )}

      </div>
    </main>
  );
}

function ItemCard({
  item,
  onEdit,
  onDelete,
}: {
  item: Item;
  onEdit: (item: Item) => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const priceLabel =
    item.pricing_type === "quote"
      ? "견적 문의"
      : item.pricing_type === "package"
        ? item.packages?.length
          ? `$${Math.min(
              ...item.packages.map((p) => Number(p.price)),
            ).toFixed(2)}~`
          : "패키지 가격"
        : item.base_price != null
          ? `$${Number(item.base_price).toFixed(2)}`
          : "-";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#E9DED0] p-4 sm:flex-row sm:items-center">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="h-24 w-28 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-24 w-28 items-center justify-center rounded-xl bg-[#FFF4E5] text-3xl">
          🍽️
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="font-black text-[#172033]">
          {item.name}
        </div>

        {item.description && (
          <div className="mt-1 line-clamp-2 text-sm text-[#667085]">
            {item.description}
          </div>
        )}

        <div className="mt-2 text-sm font-black text-[#B64032]">
          {priceLabel}
        </div>

        {item.pricing_type === "package" &&
          item.packages &&
          item.packages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.packages.map((pkg) => (
                <span
                  key={pkg.id}
                  className="rounded-full bg-[#FFF9F1] px-2.5 py-1 text-xs font-bold"
                >
                  {pkg.package_name}
                  {pkg.serving_label
                    ? ` · ${pkg.serving_label}`
                    : ""}
                  {` · $${Number(pkg.price).toFixed(2)}`}
                </span>
              ))}
            </div>
          )}

        {item.option_groups &&
          item.option_groups.length > 0 && (
            <div className="mt-2 text-xs font-bold text-[#667085]">
              옵션:{" "}
              {item.option_groups
                .map((group) => group.name)
                .join(" · ")}
            </div>
          )}
      </div>

      <div className="flex gap-2 sm:flex-col">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="rounded-xl border border-[#D9CFC2] px-3 py-2 text-sm font-black text-[#172033]"
        >
          수정
        </button>

        <button
          type="button"
          onClick={() => void onDelete(item.id)}
          className="rounded-xl border border-red-200 px-3 py-2 text-sm font-black text-red-600"
        >
          삭제
        </button>
      </div>
    </div>
  );
}