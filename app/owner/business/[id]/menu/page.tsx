"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  display_order: number | null;
  is_active: boolean;
};

type MenuOption = {
  name: string;
  priceDelta: number;
  soldOut: boolean;
  displayOrder: number;
};

type MenuOptionGroup = {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  displayOrder: number;
  options: MenuOption[];
};

type MenuOptionTemplate = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  options: MenuOption[];
};

const DEFAULT_OPTION_CATEGORY_NAMES = [
  "Options",
  "Option 2",
  "Option 3",
  "Option 4",
];

function getDefaultOptionCategoryName(index: number) {
  return DEFAULT_OPTION_CATEGORY_NAMES[index] ?? `Option ${index + 1}`;
}

type MenuItem = {
  id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  price: number | null;
  pickup_price?: number | null;
  delivery_price?: number | null;
  thumbnail_url: string | null;
  image_url: string | null;
  display_order: number | null;
  is_available: boolean;
  option_groups?: MenuOptionGroup[] | null;
  optionGroups?: MenuOptionGroup[] | null;
  menu_option_groups?: MenuOptionGroup[] | null;
};

type MenuResponse = {
  business?: {
    id: number;
    name: string | null;
  };
  categories?: Category[];
  items?: MenuItem[];
  error?: string;
};

type DeliveryProvider = {
  id?: number;
  provider_key: string;
  name: string;
  url: string;
  is_enabled: boolean;
  display_order: number;
  is_custom?: boolean;
};

const DEFAULT_DELIVERY_PROVIDERS: DeliveryProvider[] = [
  { provider_key: "doordash-online", name: "Online Ordering by DoorDash", url: "", is_enabled: false, display_order: 0 },
  { provider_key: "doordash", name: "DoorDash", url: "", is_enabled: false, display_order: 1 },
  { provider_key: "grubhub", name: "Grubhub", url: "", is_enabled: false, display_order: 2 },
  { provider_key: "seamless", name: "Seamless", url: "", is_enabled: false, display_order: 3 },
  { provider_key: "ubereats", name: "Uber Eats", url: "", is_enabled: false, display_order: 4 },
  { provider_key: "postmates", name: "Postmates", url: "", is_enabled: false, display_order: 5 },
];

function cleanPrice(value: string) {
  const normalized = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const dot = normalized.indexOf(".");

  if (dot === -1) return normalized;

  return (
    normalized.slice(0, dot + 1) +
    normalized.slice(dot + 1).replace(/\./g, "")
  );
}


function normalizeOptionGroups(item: MenuItem): MenuOptionGroup[] {
  const raw =
    item.option_groups ??
    item.optionGroups ??
    item.menu_option_groups ??
    [];

  if (!Array.isArray(raw)) return [];

  return raw.map((group, groupIndex) => ({
    name: String(group?.name || `Option Group ${groupIndex + 1}`),
    required: Boolean(group?.required),
    minSelect: Math.max(0, Math.floor(Number(group?.minSelect) || 0)),
    maxSelect:
      group?.maxSelect == null || group?.maxSelect === ("" as unknown)
        ? null
        : Math.max(0, Math.floor(Number(group.maxSelect) || 0)),
    displayOrder: Math.max(
      0,
      Math.floor(Number(group?.displayOrder) || groupIndex),
    ),
    options: Array.isArray(group?.options)
      ? group.options.map((option, optionIndex) => ({
          name: String(option?.name || `Option ${optionIndex + 1}`),
          priceDelta: Number(option?.priceDelta || 0),
          soldOut: Boolean(option?.soldOut),
          displayOrder: Math.max(
            0,
            Math.floor(Number(option?.displayOrder) || optionIndex),
          ),
        }))
      : [],
  }));
}

function nextDisplayOrder<T extends { displayOrder: number }>(rows: T[]) {
  if (!rows.length) return 0;
  return Math.max(...rows.map((row) => Number(row.displayOrder) || 0)) + 1;
}

function moveArrayItem<T>(rows: T[], from: number, to: number) {
  if (
    from < 0 ||
    to < 0 ||
    from >= rows.length ||
    to >= rows.length ||
    from === to
  ) {
    return rows;
  }

  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}



type ResizedImage = {
  detail: Blob;
  thumbnail: Blob;
};

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지 파일을 읽지 못했습니다."));
    };

    image.src = objectUrl;
  });
}

function canvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("이미지 변환에 실패했습니다."));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function resizeContainImage(
  image: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number,
) {
  const scale = Math.min(
    maxWidth / image.naturalWidth,
    maxHeight / image.naturalHeight,
    1,
  );

  const width = Math.max(
    1,
    Math.round(image.naturalWidth * scale),
  );
  const height = Math.max(
    1,
    Math.round(image.naturalHeight * scale),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이미지 처리 기능을 사용할 수 없습니다.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  return canvasToWebp(canvas, quality);
}

async function resizeSquareThumbnail(
  image: HTMLImageElement,
  size: number,
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이미지 처리 기능을 사용할 수 없습니다.");
  }

  const sourceSize = Math.min(
    image.naturalWidth,
    image.naturalHeight,
  );
  const sourceX =
    (image.naturalWidth - sourceSize) / 2;
  const sourceY =
    (image.naturalHeight - sourceSize) / 2;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size,
  );

  return canvasToWebp(canvas, quality);
}

async function createMenuImageFiles(
  file: File,
): Promise<ResizedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 선택할 수 있습니다.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("원본 파일은 20MB 이하만 선택할 수 있습니다.");
  }

  const image = await loadImageElement(file);

  const [detail, thumbnail] = await Promise.all([
    resizeContainImage(image, 1200, 1200, 0.82),
    resizeSquareThumbnail(image, 320, 0.78),
  ]);

  return {
    detail,
    thumbnail,
  };
}

export default function OwnerBusinessMenuPage() {
  const params = useParams<{ id: string }>();
  const businessId = Number(params.id);

  const [businessName, setBusinessName] = useState("Business");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});
  const [pickupPriceInputs, setPickupPriceInputs] = useState<Record<number, string>>({});
  const [deliveryPriceInputs, setDeliveryPriceInputs] = useState<Record<number, string>>({});
  const [deliveryPercentInput, setDeliveryPercentInput] = useState("15");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">(
    "all",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newMenuCategoryId, setNewMenuCategoryId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [deliveryProviders, setDeliveryProviders] = useState<DeliveryProvider[]>(
    DEFAULT_DELIVERY_PROVIDERS,
  );
  const [savingDeliveryProviders, setSavingDeliveryProviders] = useState(false);
  const [deliveryPartnersOpen, setDeliveryPartnersOpen] = useState(false);
  const [newDeliveryProviderName, setNewDeliveryProviderName] = useState("");
  const [newDeliveryProviderUrl, setNewDeliveryProviderUrl] = useState("");
  const [expandedOptionItemIds, setExpandedOptionItemIds] = useState<
    Set<number>
  >(new Set());

  const [optionTemplates, setOptionTemplates] = useState<MenuOptionTemplate[]>([]);
  const [optionTemplateOpen, setOptionTemplateOpen] = useState(false);
  const [expandedOptionTemplateIds, setExpandedOptionTemplateIds] = useState<Set<string>>(new Set());
  const [expandedSavedOptionKeys, setExpandedSavedOptionKeys] = useState<Set<string>>(new Set());
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [templateRequiredInput, setTemplateRequiredInput] = useState(false);
  const [templateMinInput, setTemplateMinInput] = useState(0);
  const [templateMaxInput, setTemplateMaxInput] = useState<number | null>(null);
  const [templateOptionsInput, setTemplateOptionsInput] = useState<MenuOption[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedTemplateByItem, setSelectedTemplateByItem] = useState<
    Record<number, string>
  >({});
  const [optionCategoryNames, setOptionCategoryNames] = useState<string[]>(
    DEFAULT_OPTION_CATEGORY_NAMES,
  );

  useEffect(() => {
    void loadMenu();
    void loadDeliveryProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);


  useEffect(() => {
    if (!Number.isInteger(businessId) || businessId <= 0) return;

    try {
      const rawCategories = window.localStorage.getItem(
        `ktown-menu-option-categories:${businessId}`,
      );

      if (rawCategories) {
        const parsedCategories = JSON.parse(rawCategories);
        if (Array.isArray(parsedCategories)) {
          const categoryCount = Math.max(
            DEFAULT_OPTION_CATEGORY_NAMES.length,
            parsedCategories.length,
          );
          const nextCategories = Array.from(
            { length: categoryCount },
            (_, index) => {
              const fallback = getDefaultOptionCategoryName(index);
              return String(parsedCategories[index] || fallback).trim() || fallback;
            },
          );
          setOptionCategoryNames(nextCategories);
        }
      }
    } catch {
      // ignore malformed local storage data
    }
  }, [businessId]);

  useEffect(() => {
    if (!Number.isInteger(businessId) || businessId <= 0) return;

    try {
      const raw = window.localStorage.getItem(
        `ktown-menu-option-templates:${businessId}`,
      );

      if (!raw) return;

      const parsed = JSON.parse(raw) as MenuOptionTemplate[];
      if (!Array.isArray(parsed)) return;

      const storedTemplates = parsed.map((template, templateIndex) => ({
        id:
          String(template?.id || "") ||
          `template-${Date.now()}-${templateIndex}`,
        name: String(template?.name || `Option ${templateIndex + 1}`),
        required: Boolean(template?.required),
        minSelect: Math.max(
          0,
          Math.floor(Number(template?.minSelect) || 0),
        ),
        maxSelect:
          template?.maxSelect == null
            ? null
            : Math.max(
                0,
                Math.floor(Number(template.maxSelect) || 0),
              ),
        options: Array.isArray(template?.options)
          ? template.options.map((option, optionIndex) => ({
              name: String(option?.name || `Option ${optionIndex + 1}`),
              priceDelta: Number(option?.priceDelta || 0),
              soldOut: Boolean(option?.soldOut),
              displayOrder: optionIndex,
            }))
          : [],
      }));

      // 메뉴에서 먼저 불러온 옵션이 있어도 localStorage가 덮어쓰지 않도록
      // 같은 이름의 그룹은 옵션 항목을 합쳐서 유지합니다.
      setOptionTemplates((current) =>
        mergeTemplateCollections(current, storedTemplates),
      );
    } catch {
      // ignore malformed local storage data
    }
  }, [businessId]);

  // 공용 옵션이 불러와지면 첫 그룹의 실제 옵션 항목을
  // 관리 입력창에도 바로 보여줍니다. "수정" 버튼을 누르지 않아도 확인 가능합니다.
  useEffect(() => {
    if (editingTemplateId || templateOptionsInput.length > 0) return;
    if (optionTemplates.length === 0) return;

    const first = optionTemplates[0];
    setEditingTemplateId(first.id);
    setTemplateNameInput(first.name);
    setTemplateRequiredInput(first.required);
    setTemplateMinInput(first.minSelect);
    setTemplateMaxInput(first.maxSelect);
    setTemplateOptionsInput(
      first.options.map((option, index) => ({
        ...option,
        displayOrder: index,
      })),
    );
  }, [optionTemplates, editingTemplateId, templateOptionsInput.length]);


  function mergeTemplateCollections(
    base: MenuOptionTemplate[],
    incoming: MenuOptionTemplate[],
  ): MenuOptionTemplate[] {
    const next = base.map((template) => ({
      ...template,
      options: template.options.map((option, index) => ({
        ...option,
        displayOrder: index,
      })),
    }));

    for (const template of incoming) {
      const normalizedName = template.name.trim().toLowerCase();
      if (!normalizedName) continue;

      const existingIndex = next.findIndex(
        (row) => row.name.trim().toLowerCase() === normalizedName,
      );

      if (existingIndex === -1) {
        next.push({
          ...template,
          options: template.options.map((option, index) => ({
            ...option,
            displayOrder: index,
          })),
        });
        continue;
      }

      const existing = next[existingIndex];
      const mergedOptions = [...existing.options];

      for (const option of template.options) {
        const optionName = option.name.trim().toLowerCase();
        const optionPrice = Number(option.priceDelta || 0).toFixed(2);

        const alreadyExists = mergedOptions.some(
          (row) =>
            row.name.trim().toLowerCase() === optionName &&
            Number(row.priceDelta || 0).toFixed(2) === optionPrice,
        );

        if (!alreadyExists) {
          mergedOptions.push({
            ...option,
            displayOrder: mergedOptions.length,
          });
        }
      }

      next[existingIndex] = {
        ...existing,
        // 저장된 공용 옵션이 비어 있거나 기본값이면 실제 메뉴 설정을 사용합니다.
        required:
          existing.options.length === 0 ? template.required : existing.required,
        minSelect:
          existing.options.length === 0 ? template.minSelect : existing.minSelect,
        maxSelect:
          existing.options.length === 0 ? template.maxSelect : existing.maxSelect,
        options: mergedOptions.map((option, index) => ({
          ...option,
          displayOrder: index,
        })),
      };
    }

    return next;
  }

  function buildTemplatesFromRegisteredMenu(
    menuItems: MenuItem[],
  ): MenuOptionTemplate[] {
    const templates: MenuOptionTemplate[] = [];

    for (const item of menuItems) {
      for (const group of normalizeOptionGroups(item)) {
        const normalizedName = group.name.trim();
        if (!normalizedName) continue;

        const template: MenuOptionTemplate = {
          id: `existing-${item.id}-${group.displayOrder}-${templates.length}`,
          name: normalizedName,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          options: group.options.map((option, optionIndex) => ({
            ...option,
            displayOrder: optionIndex,
          })),
        };

        const merged = mergeTemplateCollections(templates, [template]);
        templates.splice(0, templates.length, ...merged);
      }
    }

    return templates;
  }

  function mergeRegisteredTemplates(
    registered: MenuOptionTemplate[],
  ) {
    setOptionTemplates((current) => {
      const next = mergeTemplateCollections(current, registered);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `ktown-menu-option-templates:${businessId}`,
          JSON.stringify(next),
        );
      }

      return next;
    });
  }

  function persistOptionTemplates(next: MenuOptionTemplate[]) {
    setOptionTemplates(next);

    if (
      typeof window !== "undefined" &&
      Number.isInteger(businessId) &&
      businessId > 0
    ) {
      window.localStorage.setItem(
        `ktown-menu-option-templates:${businessId}`,
        JSON.stringify(next),
      );
    }
  }

  function persistOptionCategoryNames(next: string[]) {
    const categoryCount = Math.max(DEFAULT_OPTION_CATEGORY_NAMES.length, next.length);
    const normalized = Array.from({ length: categoryCount }, (_, index) => {
      const fallback = getDefaultOptionCategoryName(index);
      return String(next[index] || fallback).trim() || fallback;
    });

    setOptionCategoryNames(normalized);

    if (
      typeof window !== "undefined" &&
      Number.isInteger(businessId) &&
      businessId > 0
    ) {
      window.localStorage.setItem(
        `ktown-menu-option-categories:${businessId}`,
        JSON.stringify(normalized),
      );
    }
  }

  function updateOptionCategoryName(categoryIndex: number, value: string) {
    setOptionCategoryNames((current) =>
      current.map((name, index) => (index === categoryIndex ? value : name)),
    );
  }

  function saveOptionCategoryNames() {
    persistOptionCategoryNames(optionCategoryNames);
    setMessage("✓ 옵션 카테고리 이름을 저장했습니다.");
  }

  function ensureOptionCategoryTemplates() {
    const next = [...optionTemplates];

    for (let index = 0; index < optionCategoryNames.length; index += 1) {
      const fallback = getDefaultOptionCategoryName(index);
      const name =
        String(optionCategoryNames[index] || fallback).trim() || fallback;
      const exists = next.some(
        (template) => template.name.trim().toLowerCase() === name.toLowerCase(),
      );

      if (!exists) {
        next.push({
          id: `category-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          required: false,
          minSelect: 0,
          maxSelect: null,
          options: [],
        });
      }
    }

    persistOptionTemplates(next);
  }

  function addOptionCategory() {
    const categoryIndex = optionCategoryNames.length;
    const newName = getDefaultOptionCategoryName(categoryIndex);
    const nextNames = [...optionCategoryNames, newName];

    persistOptionCategoryNames(nextNames);

    const exists = optionTemplates.some(
      (template) => template.name.trim().toLowerCase() === newName.toLowerCase(),
    );

    if (!exists) {
      persistOptionTemplates([
        ...optionTemplates,
        {
          id: `category-${categoryIndex}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          name: newName,
          required: false,
          minSelect: 0,
          maxSelect: null,
          options: [],
        },
      ]);
    }

    setMessage(`✓ 옵션 카테고리 ${categoryIndex + 1}을 추가했습니다.`);
  }

  function updateSavedOptionPrice(
    templateId: string,
    optionIndex: number,
    rawValue: string,
  ) {
    const cleaned = cleanPrice(rawValue);
    const priceDelta = cleaned === "" ? 0 : Number(cleaned);

    if (!Number.isFinite(priceDelta) || priceDelta < 0) return;

    const next = optionTemplates.map((template) => {
      if (template.id !== templateId) return template;

      return {
        ...template,
        options: template.options.map((option, index) =>
          index === optionIndex
            ? { ...option, priceDelta: Number(priceDelta.toFixed(2)) }
            : option,
        ),
      };
    });

    persistOptionTemplates(next);

    if (editingTemplateId === templateId) {
      setTemplateOptionsInput((current) =>
        current.map((option, index) =>
          index === optionIndex
            ? { ...option, priceDelta: Number(priceDelta.toFixed(2)) }
            : option,
        ),
      );
    }
  }

  function moveSavedOptionToCategory(
    sourceTemplateId: string,
    optionIndex: number,
    targetCategoryIndex: number,
  ) {
    const sourceTemplate = optionTemplates.find(
      (template) => template.id === sourceTemplateId,
    );
    const movingOption = sourceTemplate?.options[optionIndex];

    if (!sourceTemplate || !movingOption) return;

    const targetName =
      String(
        optionCategoryNames[targetCategoryIndex] ||
          getDefaultOptionCategoryName(targetCategoryIndex),
      ).trim() || getDefaultOptionCategoryName(targetCategoryIndex);

    if (sourceTemplate.name.trim().toLowerCase() === targetName.toLowerCase()) {
      setMessage(`✓ 이미 "${targetName}" 카테고리에 있습니다.`);
      return;
    }

    let next = optionTemplates.map((template) =>
      template.id === sourceTemplateId
        ? {
            ...template,
            options: template.options
              .filter((_, index) => index !== optionIndex)
              .map((option, index) => ({ ...option, displayOrder: index })),
          }
        : {
            ...template,
            options: template.options.map((option, index) => ({
              ...option,
              displayOrder: index,
            })),
          },
    );

    let targetIndex = next.findIndex(
      (template) =>
        template.name.trim().toLowerCase() === targetName.toLowerCase(),
    );

    if (targetIndex === -1) {
      next = [
        ...next,
        {
          id: `category-${targetCategoryIndex}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          name: targetName,
          required: false,
          minSelect: 0,
          maxSelect: null,
          options: [{ ...movingOption, displayOrder: 0 }],
        },
      ];
      targetIndex = next.length - 1;
    } else {
      const target = next[targetIndex];
      const duplicate = target.options.some(
        (option) =>
          option.name.trim().toLowerCase() ===
          movingOption.name.trim().toLowerCase(),
      );

      if (duplicate) {
        window.alert(`"${movingOption.name}" 옵션 이름이 이미 "${targetName}" 카테고리에 있습니다. 같은 이름은 이동할 수 없습니다.`);
        setMessage(`⚠️ "${movingOption.name}" 옵션 이름이 이미 "${targetName}" 카테고리에 있습니다. 같은 이름은 이동할 수 없습니다.`);
        return;
      }

      if (!duplicate) {
        next[targetIndex] = {
          ...target,
          options: [
            ...target.options,
            { ...movingOption, displayOrder: target.options.length },
          ],
        };
      }
    }

    persistOptionTemplates(next);

    // 이동한 뒤에는 대상 카테고리를 즉시 편집창에 보여줍니다.
    const targetTemplate = next[targetIndex];
    if (targetTemplate) {
      setEditingTemplateId(targetTemplate.id);
      setTemplateNameInput(targetTemplate.name);
      setTemplateRequiredInput(targetTemplate.required);
      setTemplateMinInput(targetTemplate.minSelect);
      setTemplateMaxInput(targetTemplate.maxSelect);
      setTemplateOptionsInput(
        targetTemplate.options.map((option, index) => ({
          ...option,
          displayOrder: index,
        })),
      );
      setOptionTemplateOpen(true);
    }

    setMessage(
      `✓ "${movingOption.name}" → "${targetName}" 카테고리로 이동했습니다. 이동한 카테고리를 바로 보여줍니다.`,
    );
  }


  function moveMenuOptionToCategory(
    itemId: number,
    sourceGroupIndex: number,
    optionIndex: number,
    targetCategoryIndex: number,
  ) {
    const targetName =
      String(
        optionCategoryNames[targetCategoryIndex] ||
          getDefaultOptionCategoryName(targetCategoryIndex),
      ).trim() || getDefaultOptionCategoryName(targetCategoryIndex);

    const sourceItem = items.find((item) => item.id === itemId);
    const sourceGroups = sourceItem ? normalizeOptionGroups(sourceItem) : [];
    const sourceGroup = sourceGroups[sourceGroupIndex];
    const movingOption = sourceGroup?.options[optionIndex];

    if (!sourceGroup || !movingOption) return;

    if (sourceGroup.name.trim().toLowerCase() === targetName.toLowerCase()) {
      setMessage(`✓ 이미 "${targetName}" 카테고리에 있습니다.`);
      return;
    }

    const targetTemplate = optionTemplates.find(
      (template) =>
        template.name.trim().toLowerCase() === targetName.toLowerCase(),
    );

    updateOptionGroups(itemId, (groups) => {
      const source = groups[sourceGroupIndex];
      const optionToMove = source?.options[optionIndex];
      if (!source || !optionToMove) return groups;

      const next = groups.map((group) => ({
        ...group,
        options: group.options.map((option) => ({ ...option })),
      }));

      next[sourceGroupIndex] = {
        ...next[sourceGroupIndex],
        options: next[sourceGroupIndex].options.filter(
          (_, index) => index !== optionIndex,
        ),
      };

      const targetGroupIndex = next.findIndex(
        (group) =>
          group.name.trim().toLowerCase() === targetName.toLowerCase(),
      );

      if (targetGroupIndex >= 0) {
        next[targetGroupIndex] = {
          ...next[targetGroupIndex],
          options: [
            ...next[targetGroupIndex].options,
            {
              ...optionToMove,
              displayOrder: next[targetGroupIndex].options.length,
            },
          ],
        };
      } else {
        next.push({
          name: targetName,
          required: targetTemplate?.required ?? false,
          minSelect: targetTemplate?.minSelect ?? 0,
          maxSelect: targetTemplate?.maxSelect ?? null,
          displayOrder: next.length,
          options: [{ ...optionToMove, displayOrder: 0 }],
        });
      }

      return next;
    });

    setMessage(
      `✓ "${movingOption.name}" → "${targetName}" 옵션 카테고리로 이동했습니다. 아래 전체 저장을 눌러 DB에 반영하세요.`,
    );
  }

  function resetOptionTemplateForm() {
    setEditingTemplateId(null);
    setTemplateNameInput("");
    setTemplateRequiredInput(false);
    setTemplateMinInput(0);
    setTemplateMaxInput(null);
    setTemplateOptionsInput([]);
  }

  function addTemplateOption() {
    setTemplateOptionsInput((current) => [
      ...current,
      {
        name: "New option",
        priceDelta: 0,
        soldOut: false,
        displayOrder: current.length,
      },
    ]);
  }

  function updateTemplateOption(
    optionIndex: number,
    patch: Partial<MenuOption>,
  ) {
    setTemplateOptionsInput((current) =>
      current.map((option, index) =>
        index === optionIndex ? { ...option, ...patch } : option,
      ),
    );
  }


  function moveEditingTemplateOptionToCategory(
    optionIndex: number,
    targetCategoryIndex: number,
  ) {
    const movingOption = templateOptionsInput[optionIndex];
    if (!movingOption) return;

    const targetName =
      String(
        optionCategoryNames[targetCategoryIndex] ||
          getDefaultOptionCategoryName(targetCategoryIndex),
      ).trim() || getDefaultOptionCategoryName(targetCategoryIndex);

    const sourceName = templateNameInput.trim();

    if (sourceName.toLowerCase() === targetName.toLowerCase()) {
      setMessage(`✓ 이미 "${targetName}" 카테고리에 있습니다.`);
      return;
    }

    // 현재 편집 중인 내용까지 포함해서 source 그룹을 먼저 최신 상태로 만듭니다.
    const sourceOptions = templateOptionsInput
      .filter((_, index) => index !== optionIndex)
      .map((option, index) => ({ ...option, displayOrder: index }));

    let next = optionTemplates.map((template) => ({
      ...template,
      options: template.options.map((option, index) => ({
        ...option,
        displayOrder: index,
      })),
    }));

    let sourceIndex = editingTemplateId
      ? next.findIndex((template) => template.id === editingTemplateId)
      : -1;

    if (sourceIndex === -1) {
      sourceIndex = next.findIndex(
        (template) =>
          template.name.trim().toLowerCase() === sourceName.toLowerCase(),
      );
    }

    if (sourceIndex >= 0) {
      next[sourceIndex] = {
        ...next[sourceIndex],
        name: sourceName || next[sourceIndex].name,
        required: templateRequiredInput,
        minSelect: Math.max(0, templateMinInput),
        maxSelect: templateMaxInput == null ? null : Math.max(0, templateMaxInput),
        options: sourceOptions,
      };
    }

    let targetIndex = next.findIndex(
      (template) =>
        template.name.trim().toLowerCase() === targetName.toLowerCase(),
    );

    if (targetIndex === -1) {
      next.push({
        id: `category-${targetCategoryIndex}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        name: targetName,
        required: false,
        minSelect: 0,
        maxSelect: null,
        options: [{ ...movingOption, displayOrder: 0 }],
      });
      targetIndex = next.length - 1;
    } else {
      const target = next[targetIndex];
      const duplicate = target.options.some(
        (option) =>
          option.name.trim().toLowerCase() ===
          movingOption.name.trim().toLowerCase(),
      );

      if (duplicate) {
        window.alert(`"${movingOption.name}" 옵션 이름이 이미 "${targetName}" 카테고리에 있습니다. 같은 이름은 이동할 수 없습니다.`);
        setMessage(`⚠️ "${movingOption.name}" 옵션 이름이 이미 "${targetName}" 카테고리에 있습니다. 같은 이름은 이동할 수 없습니다.`);
        return;
      }

      if (!duplicate) {
        next[targetIndex] = {
          ...target,
          options: [
            ...target.options,
            { ...movingOption, displayOrder: target.options.length },
          ],
        };
      }
    }

    // source에서 빠진 상태 + target에 들어간 상태를 동시에 저장합니다.
    persistOptionTemplates(next);

    // 핵심: 옵션을 옮긴 직후 대상 카테고리로 화면을 바꾸고,
    // 방금 이동한 옵션이 포함된 목록을 즉시 보여줍니다.
    const targetTemplate = next[targetIndex];
    if (targetTemplate) {
      setEditingTemplateId(targetTemplate.id);
      setTemplateNameInput(targetTemplate.name);
      setTemplateRequiredInput(targetTemplate.required);
      setTemplateMinInput(targetTemplate.minSelect);
      setTemplateMaxInput(targetTemplate.maxSelect);
      setTemplateOptionsInput(
        targetTemplate.options.map((option, index) => ({
          ...option,
          displayOrder: index,
        })),
      );
      setOptionTemplateOpen(true);
    }

    setMessage(
      `✓ "${movingOption.name}" → "${targetName}" 카테고리로 이동했습니다. 지금 "${targetName}" 옵션을 보여주고 있습니다.`,
    );
  }


  function deleteTemplateOptionRow(optionIndex: number) {
    setTemplateOptionsInput((current) =>
      current
        .filter((_, index) => index !== optionIndex)
        .map((option, index) => ({
          ...option,
          displayOrder: index,
        })),
    );
  }

  function saveOptionTemplate() {
    const name = templateNameInput.trim();

    if (!name) {
      setMessage("옵션 그룹 이름을 입력하세요.");
      return;
    }

    if (templateOptionsInput.length === 0) {
      setMessage("옵션 항목을 하나 이상 추가하세요.");
      return;
    }

    // 같은 옵션 카테고리 안에서는 옵션 이름 중복 저장 금지 (대소문자/앞뒤 공백 무시)
    const seenOptionNames = new Set<string>();
    const duplicateOption = templateOptionsInput.find((option) => {
      const optionName = option.name.trim().toLowerCase();
      if (!optionName) return false;
      if (seenOptionNames.has(optionName)) return true;
      seenOptionNames.add(optionName);
      return false;
    });

    if (duplicateOption) {
      const duplicateName = duplicateOption.name.trim();
      window.alert(`"${duplicateName}" 옵션 이름이 이미 있습니다. 같은 이름은 저장할 수 없습니다.`);
      setMessage(`⚠️ "${duplicateName}" 옵션 이름이 이미 있습니다. 같은 이름은 저장할 수 없습니다.`);
      return;
    }

    if (
      templateMaxInput != null &&
      templateMaxInput < templateMinInput
    ) {
      setMessage("최대 선택 수는 최소 선택 수보다 작을 수 없습니다.");
      return;
    }

    const template: MenuOptionTemplate = {
      id:
        editingTemplateId ??
        `template-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
      name,
      required: templateRequiredInput,
      minSelect: Math.max(0, templateMinInput),
      maxSelect:
        templateMaxInput == null
          ? null
          : Math.max(0, templateMaxInput),
      options: templateOptionsInput.map((option, index) => ({
        name: option.name.trim() || `Option ${index + 1}`,
        priceDelta: Number(option.priceDelta || 0),
        soldOut: Boolean(option.soldOut),
        displayOrder: index,
      })),
    };

    const wasEdit = Boolean(editingTemplateId);

    persistOptionTemplates(
      editingTemplateId
        ? optionTemplates.map((row) =>
            row.id === editingTemplateId ? template : row,
          )
        : [...optionTemplates, template],
    );

    resetOptionTemplateForm();
    setMessage(
      wasEdit
        ? "✓ 공용 옵션 그룹을 수정했습니다."
        : "✓ 공용 옵션 그룹을 등록했습니다.",
    );
  }

  function editOptionTemplate(template: MenuOptionTemplate) {
    setEditingTemplateId(template.id);
    setTemplateNameInput(template.name);
    setTemplateRequiredInput(template.required);
    setTemplateMinInput(template.minSelect);
    setTemplateMaxInput(template.maxSelect);
    setTemplateOptionsInput(
      template.options.map((option, index) => ({
        ...option,
        displayOrder: index,
      })),
    );
    setOptionTemplateOpen(true);
  }

  function deleteOptionTemplate(templateId: string) {
    if (!window.confirm("이 공용 옵션 그룹을 삭제할까요?")) return;

    persistOptionTemplates(
      optionTemplates.filter((template) => template.id !== templateId),
    );

    if (editingTemplateId === templateId) {
      resetOptionTemplateForm();
    }

    setMessage("✓ 공용 옵션 그룹을 삭제했습니다.");
  }

  function applyOptionTemplateToItem(itemId: number) {
    const templateId = selectedTemplateByItem[itemId];
    const template = optionTemplates.find(
      (row) => row.id === templateId,
    );

    if (!template) {
      setMessage("불러올 공용 옵션을 선택하세요.");
      return;
    }

    updateOptionGroups(itemId, (groups) => [
      ...groups,
      {
        name: template.name,
        required: template.required,
        minSelect: template.minSelect,
        maxSelect: template.maxSelect,
        displayOrder: groups.length,
        options: template.options.map((option, index) => ({
          ...option,
          displayOrder: index,
        })),
      },
    ]);

    setExpandedOptionItemIds((current) => {
      const next = new Set(current);
      next.add(itemId);
      return next;
    });

    setMessage(
      `✓ "${template.name}" 공용 옵션을 메뉴에 추가했습니다. 아래 전체 저장을 눌러 DB에 반영하세요.`,
    );
  }

  function saveGroupAsTemplate(
    item: MenuItem,
    group: MenuOptionGroup,
  ) {
    const baseName =
      group.name.trim() || `${item.name} Option`;

    const template: MenuOptionTemplate = {
      id: `template-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      name: baseName,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((option, index) => ({
        ...option,
        displayOrder: index,
      })),
    };

    persistOptionTemplates([...optionTemplates, template]);
    setMessage(`✓ "${baseName}" 옵션을 공용 옵션에 저장했습니다.`);
  }

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("로그인이 필요합니다.");
    }

    return session.access_token;
  }

  async function loadMenu() {
    setLoading(true);
    setMessage("");

    try {
      if (!Number.isInteger(businessId) || businessId <= 0) {
        throw new Error("잘못된 비즈니스 ID입니다.");
      }

      const token = await getAccessToken();

      const response = await fetch(`/api/owner/business/${businessId}/menu`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = (await response.json()) as MenuResponse;

      if (!response.ok) {
        throw new Error(data.error || "메뉴를 불러오지 못했습니다.");
      }

      const nextCategories = data.categories || [];
      const nextItems = (data.items || []).map((item) => ({
        ...item,
        option_groups: normalizeOptionGroups(item),
      }));

      setBusinessName(data.business?.name || "Business");
      setCategories(nextCategories);
      setItems(nextItems);

      // DB에 이미 저장되어 각 메뉴에 붙어 있는 옵션 그룹도
      // 공용 옵션 관리에 자동으로 나타나게 합니다.
      mergeRegisteredTemplates(
        buildTemplatesFromRegisteredMenu(nextItems),
      );

      setNewMenuCategoryId((current) => {
        if (
          current !== "" &&
          nextCategories.some((category) => category.id === current)
        ) {
          return current;
        }

        const preferred =
          selectedCategoryId !== "all" &&
          nextCategories.some(
            (category) => category.id === selectedCategoryId,
          )
            ? selectedCategoryId
            : nextCategories.find((category) => category.is_active)?.id ??
              nextCategories[0]?.id ??
              "";

        return preferred;
      });

      const nextPrices: Record<number, string> = {};
      const nextPickupPrices: Record<number, string> = {};
      const nextDeliveryPrices: Record<number, string> = {};

      for (const item of nextItems) {
        nextPrices[item.id] =
          item.price === null || item.price === undefined
            ? ""
            : Number(item.price).toFixed(2);

        nextPickupPrices[item.id] =
          item.pickup_price == null
            ? nextPrices[item.id]
            : Number(item.pickup_price).toFixed(2);

        nextDeliveryPrices[item.id] =
          item.delivery_price == null
            ? nextPickupPrices[item.id]
            : Number(item.delivery_price).toFixed(2);
      }

      setPriceInputs(nextPrices);
      setPickupPriceInputs(nextPickupPrices);
      setDeliveryPriceInputs(nextDeliveryPrices);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "메뉴를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  const itemCountByCategory = useMemo(() => {
    const counts: Record<number, number> = {};

    for (const item of items) {
      if (item.category_id !== null) {
        counts[item.category_id] = (counts[item.category_id] || 0) + 1;
      }
    }

    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      if (
        selectedCategoryId !== "all" &&
        item.category_id !== selectedCategoryId
      ) {
        return false;
      }

      if (!keyword) return true;

      return [item.name, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, searchTerm, selectedCategoryId]);

  function updateCategory(
    categoryId: number,
    patch: Partial<Category>,
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    );
    setMessage("");
  }

  function updateItem(itemId: number, patch: Partial<MenuItem>) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    );
    setMessage("");
  }


  function toggleOptionManager(itemId: number) {
    setExpandedOptionItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function updateOptionGroups(
    itemId: number,
    updater: (groups: MenuOptionGroup[]) => MenuOptionGroup[],
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;

        const groups = normalizeOptionGroups(item);
        const nextGroups = updater(groups).map((group, groupIndex) => ({
          ...group,
          displayOrder: groupIndex,
          options: group.options.map((option, optionIndex) => ({
            ...option,
            displayOrder: optionIndex,
          })),
        }));

        return {
          ...item,
          option_groups: nextGroups,
          optionGroups: nextGroups,
          menu_option_groups: nextGroups,
        };
      }),
    );
    setMessage("");
  }

  function addOptionGroup(itemId: number) {
    updateOptionGroups(itemId, (groups) => [
      ...groups,
      {
        name: "NEW OPTION GROUP",
        required: false,
        minSelect: 0,
        maxSelect: null,
        displayOrder: nextDisplayOrder(groups),
        options: [],
      },
    ]);

    setExpandedOptionItemIds((current) => {
      const next = new Set(current);
      next.add(itemId);
      return next;
    });
  }

  function updateOptionGroup(
    itemId: number,
    groupIndex: number,
    patch: Partial<MenuOptionGroup>,
  ) {
    updateOptionGroups(itemId, (groups) =>
      groups.map((group, index) =>
        index === groupIndex ? { ...group, ...patch } : group,
      ),
    );
  }

  function deleteOptionGroup(itemId: number, groupIndex: number) {
    if (!window.confirm("이 옵션 그룹을 삭제할까요?")) return;

    updateOptionGroups(itemId, (groups) =>
      groups.filter((_, index) => index !== groupIndex),
    );
  }

  function moveOptionGroup(
    itemId: number,
    groupIndex: number,
    direction: -1 | 1,
  ) {
    updateOptionGroups(itemId, (groups) =>
      moveArrayItem(groups, groupIndex, groupIndex + direction),
    );
  }

  function addOption(itemId: number, groupIndex: number) {
    updateOptionGroups(itemId, (groups) =>
      groups.map((group, index) => {
        if (index !== groupIndex) return group;

        return {
          ...group,
          options: [
            ...group.options,
            {
              name: "New option",
              priceDelta: 0,
              soldOut: false,
              displayOrder: nextDisplayOrder(group.options),
            },
          ],
        };
      }),
    );
  }

  function updateOption(
    itemId: number,
    groupIndex: number,
    optionIndex: number,
    patch: Partial<MenuOption>,
  ) {
    updateOptionGroups(itemId, (groups) =>
      groups.map((group, index) => {
        if (index !== groupIndex) return group;

        return {
          ...group,
          options: group.options.map((option, innerIndex) =>
            innerIndex === optionIndex
              ? { ...option, ...patch }
              : option,
          ),
        };
      }),
    );
  }

  function deleteOption(
    itemId: number,
    groupIndex: number,
    optionIndex: number,
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;

        const groups = normalizeOptionGroups(item);

        const nextGroups = groups.map((group, index) => {
          if (index !== groupIndex) return group;

          const nextOptions = group.options
            .filter((_, innerIndex) => innerIndex !== optionIndex)
            .map((option, innerIndex) => ({
              ...option,
              displayOrder: innerIndex,
            }));

          return {
            ...group,
            options: nextOptions,
          };
        });

        return {
          ...item,
          option_groups: nextGroups,
          optionGroups: nextGroups,
          menu_option_groups: nextGroups,
        };
      }),
    );

    setMessage("✓ 옵션을 화면에서 삭제했습니다. 아래 전체 저장을 눌러 DB에 반영하세요.");
  }

  function moveOption(
    itemId: number,
    groupIndex: number,
    optionIndex: number,
    direction: -1 | 1,
  ) {
    updateOptionGroups(itemId, (groups) =>
      groups.map((group, index) => {
        if (index !== groupIndex) return group;

        return {
          ...group,
          options: moveArrayItem(
            group.options,
            optionIndex,
            optionIndex + direction,
          ),
        };
      }),
    );
  }

  async function uploadItemImage(
    itemId: number,
    file: File,
  ) {
    setUploadingItemId(itemId);
    setMessage("");

    try {
      const resized = await createMenuImageFiles(file);
      const token = await getAccessToken();
      const formData = new FormData();

      formData.append("itemId", String(itemId));
      formData.append(
        "detail",
        resized.detail,
        "detail.webp",
      );
      formData.append(
        "thumbnail",
        resized.thumbnail,
        "thumbnail.webp",
      );

      const response = await fetch(
        `/api/owner/business/${businessId}/menu/image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = (await response.json()) as {
        image_url?: string;
        thumbnail_url?: string;
        error?: string;
      };

      if (
        !response.ok ||
        !data.image_url ||
        !data.thumbnail_url
      ) {
        throw new Error(
          data.error ||
            "이미지를 등록하지 못했습니다.",
        );
      }

      updateItem(itemId, {
        image_url: data.image_url,
        thumbnail_url: data.thumbnail_url,
      });

      setMessage(
        "✓ 원본은 저장하지 않고 상세 이미지와 썸네일만 저장했습니다.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "이미지 등록 실패",
      );
    } finally {
      setUploadingItemId(null);
    }
  }

  async function removeItemImage(itemId: number) {
    if (!window.confirm("이 메뉴 이미지를 삭제할까요?")) {
      return;
    }

    setUploadingItemId(itemId);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `/api/owner/business/${businessId}/menu/image`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ itemId }),
        },
      );

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error || "이미지를 삭제하지 못했습니다.",
        );
      }

      updateItem(itemId, {
        image_url: null,
        thumbnail_url: null,
      });

      setMessage("✓ 메뉴 이미지를 삭제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "이미지 삭제 실패",
      );
    } finally {
      setUploadingItemId(null);
    }
  }

  async function loadDeliveryProviders() {
    try {
      if (!Number.isInteger(businessId) || businessId <= 0) return;

      const token = await getAccessToken();
      const response = await fetch(
        `/api/owner/business/${businessId}/delivery-providers`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );

      const data = (await response.json()) as {
        providers?: DeliveryProvider[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "배달 업체를 불러오지 못했습니다.");
      }

      const saved = Array.isArray(data.providers) ? data.providers : [];
      const savedByKey = new Map(saved.map((provider) => [provider.provider_key, provider]));

      const defaults = DEFAULT_DELIVERY_PROVIDERS.map((provider) => ({
        ...provider,
        ...(savedByKey.get(provider.provider_key) || {}),
      }));

      const custom = saved.filter(
        (provider) =>
          !DEFAULT_DELIVERY_PROVIDERS.some(
            (defaultProvider) =>
              defaultProvider.provider_key === provider.provider_key,
          ),
      );

      setDeliveryProviders(
        [...defaults, ...custom].sort(
          (a, b) =>
            Number(a.display_order ?? 999) -
            Number(b.display_order ?? 999),
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "배달 업체를 불러오지 못했습니다.",
      );
    }
  }

  function updateDeliveryProvider(
    providerKey: string,
    patch: Partial<DeliveryProvider>,
  ) {
    setDeliveryProviders((current) =>
      current.map((provider) =>
        provider.provider_key === providerKey
          ? { ...provider, ...patch }
          : provider,
      ),
    );
  }

  function addCustomDeliveryProvider() {
    const name = newDeliveryProviderName.trim();
    const url = newDeliveryProviderUrl.trim();

    if (!name || !url) {
      setMessage("업체 이름과 주문 링크를 모두 입력하세요.");
      return;
    }

    setDeliveryProviders((current) => [
      ...current,
      {
        provider_key: `custom-${Date.now()}`,
        name,
        url,
        is_enabled: true,
        display_order: current.length,
        is_custom: true,
      },
    ]);

    setNewDeliveryProviderName("");
    setNewDeliveryProviderUrl("");
    setMessage("✓ 업체를 추가했습니다. '배달 업체 저장'을 눌러주세요.");
  }

  function deleteCustomDeliveryProvider(providerKey: string) {
    setDeliveryProviders((current) =>
      current.filter(
        (provider) => provider.provider_key !== providerKey,
      ),
    );
  }

  async function saveDeliveryProviders() {
  console.log("SAVE CLICK");

  setSavingDeliveryProviders(true);
  setMessage("");

  try {
    console.log("GET TOKEN START");

    const token = await getAccessToken();

    console.log("TOKEN OK", Boolean(token));
    console.log("DELIVERY FETCH START");

    const response = await fetch(
      `/api/owner/business/${businessId}/delivery-providers`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          providers: deliveryProviders.map((provider, index) => ({
            provider_key: provider.provider_key,
            name: provider.name.trim(),
            url: provider.url.trim(),
            is_enabled: provider.is_enabled,
            display_order: index,
            is_custom:
              provider.is_custom === true ||
              provider.provider_key.startsWith("custom-"),
          })),
        }),
      },
    );

    console.log("DELIVERY RESPONSE", response.status);

    const data = await response.json();

    console.log("DELIVERY DATA", data);

    if (!response.ok) {
      throw new Error(
        data.error || "배달 업체 저장에 실패했습니다.",
      );
    }

    setDeliveryProviders(data.providers || []);
    setMessage("✓ 배달 업체 설정을 저장했습니다.");
  } catch (error) {
    console.error("DELIVERY SAVE CLIENT ERROR", error);

    setMessage(
      error instanceof Error
        ? error.message
        : "배달 업체 저장 실패",
    );
  } finally {
    setSavingDeliveryProviders(false);
  }
}

  async function addCategory() {
    const name = newCategoryName.trim();

    if (!name) {
      alert("카테고리 이름을 입력하세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(`/api/owner/business/${businessId}/menu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "add-category",
          name,
        }),
      });

      const data = (await response.json()) as MenuResponse & {
        category?: Category;
      };

      if (!response.ok || !data.category) {
        throw new Error(data.error || "카테고리를 추가하지 못했습니다.");
      }

      setCategories((current) => [...current, data.category!]);
      setNewCategoryName("");
      setMessage("✓ 카테고리를 추가했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "카테고리 추가 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category: Category) {
    const itemCount = itemCountByCategory[category.id] || 0;

    if (itemCount > 0) {
      alert(
        `이 카테고리에 메뉴 ${itemCount}개가 있습니다. 먼저 다른 카테고리로 옮겨주세요.`,
      );
      return;
    }

    if (!window.confirm(`"${category.name}" 카테고리를 삭제할까요?`)) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(`/api/owner/business/${businessId}/menu`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId: category.id,
        }),
      });

      const data = (await response.json()) as MenuResponse;

      if (!response.ok) {
        throw new Error(data.error || "카테고리를 삭제하지 못했습니다.");
      }

      setCategories((current) =>
        current.filter((row) => row.id !== category.id),
      );

      if (selectedCategoryId === category.id) {
        setSelectedCategoryId("all");
      }

      setMessage("✓ 카테고리를 삭제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "카테고리 삭제 실패",
      );
    } finally {
      setSaving(false);
    }
  }


  async function addMenuItem() {
    const categoryId =
      newMenuCategoryId === "" ? null : Number(newMenuCategoryId);

    if (categoryId === null) {
      setMessage("메뉴를 추가할 카테고리를 먼저 선택하세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `/api/owner/business/${businessId}/menu`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "add-menu-item",
            categoryId,
          }),
        },
      );

      const data = (await response.json()) as MenuResponse & {
        item?: MenuItem;
      };

      if (!response.ok || !data.item) {
        throw new Error(
          data.error || "새 메뉴를 추가하지 못했습니다.",
        );
      }

      const item: MenuItem = {
        ...data.item,
        option_groups: normalizeOptionGroups(data.item),
      };

      setItems((current) => [...current, item]);
      setPriceInputs((current) => ({
        ...current,
        [item.id]:
          item.price == null ? "" : Number(item.price).toFixed(2),
      }));
      setPickupPriceInputs((current) => ({
        ...current,
        [item.id]:
          item.pickup_price == null
            ? item.price == null ? "" : Number(item.price).toFixed(2)
            : Number(item.pickup_price).toFixed(2),
      }));
      setDeliveryPriceInputs((current) => ({
        ...current,
        [item.id]:
          item.delivery_price == null
            ? item.pickup_price == null
              ? item.price == null ? "" : Number(item.price).toFixed(2)
              : Number(item.pickup_price).toFixed(2)
            : Number(item.delivery_price).toFixed(2),
      }));
      setSelectedCategoryId(item.category_id ?? "all");
      setSearchTerm("");
      setMessage(
        "✓ 새 메뉴를 추가했습니다. 상품명·가격·옵션을 수정한 뒤 전체 저장하세요.",
      );

      window.setTimeout(() => {
        document
          .getElementById(`owner-menu-item-${item.id}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 80);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "새 메뉴 추가 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  async function duplicateMenuItem(item: MenuItem) {
    if (
      !window.confirm(
        `"${item.name}" 메뉴를 옵션과 함께 복제할까요?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `/api/owner/business/${businessId}/menu`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "duplicate-menu-item",
            itemId: item.id,
          }),
        },
      );

      const data = (await response.json()) as MenuResponse & {
        item?: MenuItem;
      };

      if (!response.ok || !data.item) {
        throw new Error(
          data.error || "메뉴를 복제하지 못했습니다.",
        );
      }

      const duplicated: MenuItem = {
        ...data.item,
        option_groups: normalizeOptionGroups(data.item),
      };

      setItems((current) => [...current, duplicated]);
      setPriceInputs((current) => ({
        ...current,
        [duplicated.id]:
          duplicated.price == null ? "" : Number(duplicated.price).toFixed(2),
      }));
      setPickupPriceInputs((current) => ({
        ...current,
        [duplicated.id]:
          duplicated.pickup_price == null
            ? duplicated.price == null ? "" : Number(duplicated.price).toFixed(2)
            : Number(duplicated.pickup_price).toFixed(2),
      }));
      setDeliveryPriceInputs((current) => ({
        ...current,
        [duplicated.id]:
          duplicated.delivery_price == null
            ? duplicated.pickup_price == null
              ? duplicated.price == null ? "" : Number(duplicated.price).toFixed(2)
              : Number(duplicated.pickup_price).toFixed(2)
            : Number(duplicated.delivery_price).toFixed(2),
      }));

      setSelectedCategoryId(
        duplicated.category_id ?? "all",
      );
      setSearchTerm("");
      setMessage("✓ 메뉴와 옵션을 복제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "메뉴 복제 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMenuItem(item: MenuItem) {
    if (
      !window.confirm(
        `"${item.name}" 메뉴를 삭제할까요?\n\n이 메뉴의 옵션 그룹과 옵션도 함께 삭제됩니다.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `/api/owner/business/${businessId}/menu`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "delete-menu-item",
            itemId: item.id,
          }),
        },
      );

      const data = (await response.json()) as MenuResponse;

      if (!response.ok) {
        throw new Error(
          data.error || "메뉴를 삭제하지 못했습니다.",
        );
      }

      setItems((current) =>
        current.filter((row) => row.id !== item.id),
      );

      setPriceInputs((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setPickupPriceInputs((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setDeliveryPriceInputs((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });

      setExpandedOptionItemIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });

      setMessage("✓ 메뉴를 삭제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "메뉴 삭제 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  function moveMenuItem(item: MenuItem, direction: -1 | 1) {
    setItems((current) => {
      const sameCategory = current
        .filter((row) => row.category_id === item.category_id)
        .sort(
          (a, b) =>
            Number(a.display_order ?? 999) -
            Number(b.display_order ?? 999),
        );

      const index = sameCategory.findIndex(
        (row) => row.id === item.id,
      );
      const targetIndex = index + direction;

      if (
        index < 0 ||
        targetIndex < 0 ||
        targetIndex >= sameCategory.length
      ) {
        return current;
      }

      const reordered = moveArrayItem(
        sameCategory,
        index,
        targetIndex,
      ).map((row, order) => ({
        ...row,
        display_order: order,
      }));

      const byId = new Map(
        reordered.map((row) => [row.id, row]),
      );

      return current.map((row) => byId.get(row.id) || row);
    });

    setMessage(
      "✓ 메뉴 순서를 변경했습니다. 아래 전체 저장을 눌러 DB에 반영하세요.",
    );
  }

  function parseOptionalPrice(rawValue: string, itemName: string, label: string) {
    const raw = rawValue.trim();
    if (!raw) return null;

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${itemName}의 ${label}이 올바르지 않습니다.`);
    }

    return Number(value.toFixed(2));
  }

  function applyDeliveryPercent(target: "filtered" | "all") {
    const percent = Number(deliveryPercentInput);

    if (!Number.isFinite(percent) || percent < -100 || percent > 1000) {
      setMessage("배달 인상률은 -100% ~ 1000% 사이로 입력하세요.");
      return;
    }

    const targetItems = target === "filtered" ? filteredItems : items;
    const targetIds = new Set(targetItems.map((item) => item.id));

    setDeliveryPriceInputs((current) => {
      const next = { ...current };

      for (const item of items) {
        if (!targetIds.has(item.id)) continue;

        const pickupRaw =
          (pickupPriceInputs[item.id] ?? priceInputs[item.id] ?? "").trim();

        if (!pickupRaw) continue;

        const pickup = Number(pickupRaw);
        if (!Number.isFinite(pickup) || pickup < 0) continue;

        next[item.id] = (
          Math.round(pickup * (1 + percent / 100) * 100) / 100
        ).toFixed(2);
      }

      return next;
    });

    setMessage(
      `✓ 배달 단가를 픽업 단가 기준 ${percent >= 0 ? "+" : ""}${percent}%로 계산했습니다. 개별 수정 후 전체 저장하세요.`,
    );
  }

  async function saveAll() {
    setSaving(true);
    setMessage("");

    try {
      const normalizedItems = items.map((item) => {
        const price = parseOptionalPrice(
          priceInputs[item.id] ?? "",
          item.name,
          "메뉴 단가",
        );
        const pickupPrice = parseOptionalPrice(
          pickupPriceInputs[item.id] ?? "",
          item.name,
          "픽업 단가",
        );
        const deliveryPrice = parseOptionalPrice(
          deliveryPriceInputs[item.id] ?? "",
          item.name,
          "배달 단가",
        );

        if (!item.name.trim()) {
          throw new Error("상품명은 비워둘 수 없습니다.");
        }

        return {
          id: item.id,
          category_id: item.category_id,
          name: item.name.trim(),
          description: item.description?.trim() || null,
          price,
          pickup_price: pickupPrice,
          delivery_price: deliveryPrice,
          display_order: Number(item.display_order ?? 999),
          is_available: item.is_available,
          option_groups: normalizeOptionGroups(item).map(
            (group, groupIndex) => {
              const name = group.name.trim();
              if (!name) {
                throw new Error(`${item.name}: 옵션 그룹 이름을 입력하세요.`);
              }

              const minSelect = Math.max(
                0,
                Math.floor(Number(group.minSelect) || 0),
              );

              const maxSelect =
                group.maxSelect == null
                  ? null
                  : Math.max(
                      0,
                      Math.floor(Number(group.maxSelect) || 0),
                    );

              if (maxSelect != null && maxSelect < minSelect) {
                throw new Error(
                  `${item.name} / ${name}: 최대 선택 수는 최소 선택 수보다 작을 수 없습니다.`,
                );
              }

              const options = group.options.map(
                (option, optionIndex) => {
                  const optionName = option.name.trim();
                  if (!optionName) {
                    throw new Error(
                      `${item.name} / ${name}: 옵션 이름을 입력하세요.`,
                    );
                  }

                  const priceDelta = Number(option.priceDelta || 0);
                  if (!Number.isFinite(priceDelta)) {
                    throw new Error(
                      `${item.name} / ${name} / ${optionName}: 추가 금액이 올바르지 않습니다.`,
                    );
                  }

                  return {
                    name: optionName,
                    priceDelta: Number(priceDelta.toFixed(2)),
                    soldOut: Boolean(option.soldOut),
                    displayOrder: optionIndex,
                  };
                },
              );

              return {
                name,
                required: Boolean(group.required),
                minSelect,
                maxSelect,
                displayOrder: groupIndex,
                options,
              };
            },
          ),
        };
      });

      const normalizedCategories = categories.map((category) => {
        if (!category.name.trim()) {
          throw new Error("카테고리 이름은 비워둘 수 없습니다.");
        }

        return {
          id: category.id,
          name: category.name.trim(),
          display_order: Number(category.display_order ?? 999),
          is_active: category.is_active,
        };
      });

      const token = await getAccessToken();

      const response = await fetch(`/api/owner/business/${businessId}/menu`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categories: normalizedCategories,
          items: normalizedItems,
        }),
      });

      const data = (await response.json()) as MenuResponse & {
        updatedCategories?: number;
        updatedItems?: number;
      };

      if (!response.ok) {
        throw new Error(data.error || "메뉴 저장에 실패했습니다.");
      }

      setMessage(
        `✓ 저장 완료: 카테고리 ${data.updatedCategories || 0}개, 메뉴 ${data.updatedItems || 0}개`,
      );

      await loadMenu();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메뉴 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-10 text-[#172033]">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 font-bold shadow">
          메뉴를 불러오는 중...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-4 pb-32 pt-6 text-[#172033] sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#B64032]">
              Menu Management
            </p>
            <h1 className="mt-1 text-2xl font-black">{businessName}</h1>
          </div>

          <Link
            href={`/owner/business/${businessId}/manage`}
            className="rounded-xl border border-[#E8DED1] bg-white px-3 py-2 text-xs font-black shadow-sm"
          >
            Back
          </Link>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${
              message.startsWith("✓")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mb-5 rounded-3xl border-2 border-orange-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-orange-600">
                Delivery Partners
              </p>
              <h2 className="mt-1 text-xl font-black">
                배달 업체 등록 · 표시 설정
              </h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-gray-600">
                체크한 업체만 손님이 DELIVERY를 눌렀을 때 표시됩니다.
                손님이 업체를 선택하면 등록한 주문 링크로 이동합니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeliveryPartnersOpen((open) => !open)}
                aria-expanded={deliveryPartnersOpen}
                className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-xs font-black text-orange-700 hover:bg-orange-100"
              >
                {deliveryPartnersOpen ? "▼ 접기" : "▶ 펼치기"}
              </button>

              <button
                type="button"
                onClick={() => void saveDeliveryProviders()}
                disabled={savingDeliveryProviders}
                className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {savingDeliveryProviders ? "저장 중..." : "배달 업체 저장"}
              </button>
            </div>
          </div>

          {deliveryPartnersOpen && (
            <>
          <div className="mt-4 space-y-2">
            {deliveryProviders.map((provider, index) => (
              <div
                key={provider.provider_key}
                className={`grid gap-2 rounded-2xl border p-3 ${
                  provider.is_enabled
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 bg-gray-50"
                } sm:grid-cols-[auto_150px_1fr_70px_auto] sm:items-center`}
              >
                <label className="flex items-center gap-2 text-xs font-black">
                  <input
                    type="checkbox"
                    checked={provider.is_enabled}
                    onChange={(event) =>
                      updateDeliveryProvider(provider.provider_key, {
                        is_enabled: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-orange-600"
                  />
                  표시
                </label>

                <input
                  value={provider.name}
                  onChange={(event) =>
                    updateDeliveryProvider(provider.provider_key, {
                      name: event.target.value,
                    })
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-orange-400"
                />

                <input
                  value={provider.url}
                  onChange={(event) =>
                    updateDeliveryProvider(provider.provider_key, {
                      url: event.target.value,
                    })
                  }
                  placeholder="https:// 주문 링크"
                  className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-orange-400"
                />

                <input
                  type="number"
                  value={index}
                  onChange={(event) => {
                    const target = Math.max(
                      0,
                      Math.min(
                        deliveryProviders.length - 1,
                        Number(event.target.value) || 0,
                      ),
                    );

                    setDeliveryProviders((current) =>
                      moveArrayItem(current, index, target).map(
                        (item, order) => ({
                          ...item,
                          display_order: order,
                        }),
                      ),
                    );
                  }}
                  title="표시 순서"
                  className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-center text-xs font-black"
                />

                {provider.is_custom ||
                provider.provider_key.startsWith("custom-") ? (
                  <button
                    type="button"
                    onClick={() =>
                      deleteCustomDeliveryProvider(provider.provider_key)
                    }
                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                  >
                    삭제
                  </button>
                ) : (
                  <span className="rounded-xl bg-white px-3 py-2 text-center text-[10px] font-black text-gray-500">
                    기본
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-3">
            <p className="text-xs font-black text-orange-900">
              + 다른 배달 업체 / 자체 주문 사이트 추가
            </p>

            <div className="mt-2 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <input
                value={newDeliveryProviderName}
                onChange={(event) =>
                  setNewDeliveryProviderName(event.target.value)
                }
                placeholder="예: koreankitchenwf.com"
                className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-bold outline-none"
              />

              <input
                value={newDeliveryProviderUrl}
                onChange={(event) =>
                  setNewDeliveryProviderUrl(event.target.value)
                }
                placeholder="https://..."
                className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-bold outline-none"
              />

              <button
                type="button"
                onClick={addCustomDeliveryProvider}
                className="rounded-xl bg-[#172033] px-4 py-2 text-xs font-black text-white"
              >
                + 업체 추가
              </button>
            </div>
          </div>
            </>
          )}
        </section>

        <section className="mb-5 rounded-3xl border-2 border-blue-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-blue-600">
                Shared Options
              </p>
              <h2 className="mt-1 text-xl font-black">
                공용 옵션 관리
              </h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-gray-600">
                이미 메뉴에 등록되어 있는 옵션도 자동으로 불러오며, Sauce, Add-ons, Size 같은 공용 옵션을 등록·수정·삭제하고 다른 메뉴에서 재사용할 수 있습니다.
              </p>
            </div>

            <div className="w-full rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black text-blue-900">
                  옵션 카테고리 {optionCategoryNames.length}개
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addOptionCategory}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-black text-blue-700"
                  >
                    + 옵션 카테고리 추가
                  </button>
                  <button
                    type="button"
                    onClick={saveOptionCategoryNames}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black text-white"
                  >
                    카테고리 이름 저장
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {optionCategoryNames.map((categoryName, categoryIndex) => (
                  <label
                    key={`option-category-name-${categoryIndex}`}
                    className="rounded-xl bg-white p-2"
                  >
                    <span className="block text-[10px] font-black text-gray-500">
                      옵션 카테고리 {categoryIndex + 1}
                    </span>
                    <input
                      value={categoryName}
                      onChange={(event) =>
                        updateOptionCategoryName(categoryIndex, event.target.value)
                      }
                      placeholder={getDefaultOptionCategoryName(categoryIndex)}
                      className="mt-1 w-full rounded-lg border border-blue-100 px-2 py-2 text-xs font-black outline-none"
                    />
                  </label>
                ))}
              </div>

              <p className="mt-2 text-[11px] font-semibold leading-5 text-blue-900/70">
                아래 옵션 항목마다 소속 카테고리를 선택해서 이동할 수 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOptionTemplateOpen((current) => !current)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white"
            >
              {optionTemplateOpen ? "접기" : "공용 옵션 열기"}
            </button>
          </div>

          {optionTemplateOpen ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={templateNameInput}
                    onChange={(event) =>
                      setTemplateNameInput(event.target.value)
                    }
                    placeholder="옵션 그룹 이름 예: Sauce / Add-ons / Size"
                    className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-black outline-none"
                  />

                  <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black">
                    <input
                      type="checkbox"
                      checked={templateRequiredInput}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setTemplateRequiredInput(checked);
                        if (checked && templateMinInput === 0) {
                          setTemplateMinInput(1);
                        }
                      }}
                    />
                    Required
                  </label>

                  <button
                    type="button"
                    onClick={resetOptionTemplateForm}
                    className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700"
                  >
                    새로 입력
                  </button>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <span className="block text-[10px] font-black text-gray-500">
                      최소 선택
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={templateMinInput}
                      onChange={(event) =>
                        setTemplateMinInput(
                          Math.max(
                            0,
                            Math.floor(Number(event.target.value) || 0),
                          ),
                        )
                      }
                      className="w-full bg-transparent text-sm font-black outline-none"
                    />
                  </label>

                  <label className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <span className="block text-[10px] font-black text-gray-500">
                      최대 선택
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={templateMaxInput == null ? "" : templateMaxInput}
                      placeholder="제한 없음"
                      onChange={(event) =>
                        setTemplateMaxInput(
                          event.target.value === ""
                            ? null
                            : Math.max(
                                0,
                                Math.floor(Number(event.target.value) || 0),
                              ),
                        )
                      }
                      className="w-full bg-transparent text-sm font-black outline-none"
                    />
                  </label>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-blue-100 bg-white">
                  {templateOptionsInput.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs font-bold text-gray-400">
                      옵션 항목이 없습니다. 아래 버튼으로 추가하세요.
                    </div>
                  ) : (
                    templateOptionsInput.map((option, optionIndex) => (
                      <div
                        key={`template-option-${optionIndex}`}
                        className="grid gap-2 border-b border-gray-100 p-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_96px_150px_auto_auto]"
                      >
                        <input
                          value={option.name}
                          onChange={(event) =>
                            updateTemplateOption(optionIndex, {
                              name: event.target.value,
                            })
                          }
                          placeholder="옵션 이름"
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold outline-none"
                        />

                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black text-gray-500">
                            +$
                          </span>
                          <input
                            key={`template-price-${editingTemplateId ?? "new"}-${optionIndex}-${option.priceDelta}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={String(option.priceDelta ?? 0)}
                            onInput={(event) => {
                              const input = event.currentTarget;
                              const cleaned = cleanPrice(input.value);
                              if (input.value !== cleaned) input.value = cleaned;
                            }}
                            onBlur={(event) => {
                              const cleaned = cleanPrice(event.currentTarget.value);
                              const priceDelta = cleaned === "" || cleaned === "."
                                ? 0
                                : Number(cleaned);
                              const normalized = Number.isFinite(priceDelta)
                                ? Math.max(0, Number(priceDelta.toFixed(2)))
                                : 0;
                              updateTemplateOption(optionIndex, { priceDelta: normalized });
                              event.currentTarget.value = String(normalized);
                            }}
                            className="w-full rounded-lg border border-gray-200 py-2 pl-7 pr-2 text-xs font-black outline-none"
                          />
                        </div>

                        <select
                          value={Math.max(
                            0,
                            optionCategoryNames.findIndex(
                              (name) =>
                                name.trim().toLowerCase() ===
                                templateNameInput.trim().toLowerCase(),
                            ),
                          )}
                          onChange={(event) =>
                            moveEditingTemplateOptionToCategory(
                              optionIndex,
                              Number(event.target.value),
                            )
                          }
                          title="옵션 카테고리 이동"
                          className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-[11px] font-black text-blue-900 outline-none"
                        >
                          {optionCategoryNames.map((name, categoryIndex) => (
                            <option
                              key={`editing-template-${optionIndex}-category-${categoryIndex}`}
                              value={categoryIndex}
                            >
                              {name || `Option ${categoryIndex + 1}`}
                            </option>
                          ))}
                        </select>

                        <label className="flex items-center justify-center gap-1 rounded-lg bg-gray-50 px-2 py-2 text-[10px] font-black">
                          <input
                            type="checkbox"
                            checked={option.soldOut}
                            onChange={(event) =>
                              updateTemplateOption(optionIndex, {
                                soldOut: event.target.checked,
                              })
                            }
                          />
                          Sold Out
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            deleteTemplateOptionRow(optionIndex)
                          }
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                        >
                          삭제
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addTemplateOption}
                    className="rounded-xl border border-dashed border-blue-300 bg-white px-4 py-2 text-xs font-black text-blue-700"
                  >
                    + 옵션 항목 추가
                  </button>

                  <button
                    type="button"
                    onClick={saveOptionTemplate}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white"
                  >
                    {editingTemplateId
                      ? "공용 옵션 수정 저장"
                      : "공용 옵션 등록"}
                  </button>
                </div>
              </div>

              {optionTemplates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-xs font-bold text-gray-500">
                  등록된 공용 옵션이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {optionTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-2xl border border-gray-200 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOptionTemplateIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(template.id)) next.delete(template.id);
                                  else next.add(template.id);
                                  return next;
                                })
                              }
                              className="flex items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-gray-50"
                              aria-expanded={expandedOptionTemplateIds.has(template.id)}
                            >
                              <span className="text-xs font-black text-gray-500">
                                {expandedOptionTemplateIds.has(template.id) ? "▼" : "▶"}
                              </span>
                              <p className="font-black">{template.name}</p>
                            </button>
                            {template.id.startsWith("existing-") ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                기존 메뉴 옵션
                              </span>
                            ) : null}
                          </div>
                          {expandedOptionTemplateIds.has(template.id) && (template.options.length === 0 ? (
                            <p className="mt-1 text-xs font-semibold text-gray-400">
                              아직 옵션 항목이 없습니다.
                            </p>
                          ) : (
                            <div className="mt-2 space-y-1">
                              {template.options.map((option, optionIndex) => {
                                const optionKey = `${template.id}-saved-option-${optionIndex}`;
                                const optionOpen = expandedSavedOptionKeys.has(optionKey);

                                return (
                                  <div
                                    key={optionKey}
                                    className="rounded-lg bg-gray-50 p-2"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedSavedOptionKeys((current) => {
                                          const next = new Set(current);
                                          if (next.has(optionKey)) next.delete(optionKey);
                                          else next.add(optionKey);
                                          return next;
                                        })
                                      }
                                      className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-white"
                                      aria-expanded={optionOpen}
                                    >
                                      <span className="text-[11px] font-black text-gray-500">
                                        {optionOpen ? "▼" : "▶"}
                                      </span>
                                      <span className="text-xs font-bold">
                                        {option.name}
                                      </span>
                                    </button>

                                    {optionOpen && (
                                      <div className="mt-2 grid gap-2 sm:grid-cols-[110px_150px_auto] sm:items-center">
                                        <div className="relative">
                                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-black text-gray-500">
                                            +$
                                          </span>
                                          <input
                                            key={`${template.id}-saved-price-${optionIndex}-${option.priceDelta}`}
                                            type="text"
                                            inputMode="decimal"
                                            defaultValue={String(option.priceDelta ?? 0)}
                                            onInput={(event) => {
                                              const input = event.currentTarget;
                                              const cleaned = cleanPrice(input.value);
                                              if (input.value !== cleaned) input.value = cleaned;
                                            }}
                                            onBlur={(event) => {
                                              const cleaned = cleanPrice(event.currentTarget.value);
                                              const priceDelta =
                                                cleaned === "" || cleaned === "."
                                                  ? 0
                                                  : Number(cleaned);
                                              const normalized = Number.isFinite(priceDelta)
                                                ? Math.max(0, Number(priceDelta.toFixed(2)))
                                                : 0;
                                              updateSavedOptionPrice(
                                                template.id,
                                                optionIndex,
                                                String(normalized),
                                              );
                                              event.currentTarget.value = String(normalized);
                                              setMessage(
                                                `✓ "${option.name}" 가격을 +$${normalized.toFixed(2)}로 수정했습니다.`,
                                              );
                                            }}
                                            aria-label={`${option.name} 추가 가격`}
                                            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-7 pr-2 text-[11px] font-black outline-none focus:border-blue-400"
                                          />
                                        </div>

                                        <select
                                          defaultValue={
                                            Math.max(
                                              0,
                                              optionCategoryNames.findIndex(
                                                (name) =>
                                                  name.trim().toLowerCase() ===
                                                  template.name.trim().toLowerCase(),
                                              ),
                                            )
                                          }
                                          id={`${template.id}-category-${optionIndex}`}
                                          className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-[11px] font-black outline-none"
                                        >
                                          {optionCategoryNames.map((name, categoryIndex) => (
                                            <option
                                              key={`${template.id}-${optionIndex}-category-${categoryIndex}`}
                                              value={categoryIndex}
                                            >
                                              {name || `Option ${categoryIndex + 1}`}
                                            </option>
                                          ))}
                                        </select>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const element = document.getElementById(
                                              `${template.id}-category-${optionIndex}`,
                                            ) as HTMLSelectElement | null;
                                            moveSavedOptionToCategory(
                                              template.id,
                                              optionIndex,
                                              Number(element?.value || 0),
                                            );
                                          }}
                                          className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black text-white"
                                        >
                                          이동
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editOptionTemplate(template)}
                            className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              deleteOptionTemplate(template.id)
                            }
                            className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addCategory();
                }
              }}
              placeholder="새 카테고리 이름"
              className="min-w-0 flex-1 rounded-xl border border-[#E8DED1] px-4 py-3 text-sm font-bold outline-none focus:border-[#172033]"
            />

            <button
              type="button"
              onClick={() => void addCategory()}
              disabled={saving}
              className="rounded-xl bg-[#172033] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              + 카테고리 추가
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {categories.length === 0 ? (
              <div className="rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-yellow-800">
                카테고리가 없습니다. 도어대시 업데이트 과정에서
                business_menu_categories 테이블에도 카테고리가 저장됐는지 확인하세요.
              </div>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="grid gap-2 rounded-2xl border border-[#EEE5DA] p-3 sm:grid-cols-[1fr_90px_auto_auto]"
                >
                  <input
                    value={category.name}
                    onChange={(event) =>
                      updateCategory(category.id, {
                        name: event.target.value,
                      })
                    }
                    className="min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm font-black outline-none focus:border-[#172033]"
                  />

                  <input
                    type="number"
                    value={category.display_order ?? 999}
                    onChange={(event) =>
                      updateCategory(category.id, {
                        display_order: Number(event.target.value),
                      })
                    }
                    className="rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-black outline-none"
                    title="노출 순서"
                  />

                  <label className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={category.is_active}
                      onChange={(event) =>
                        updateCategory(category.id, {
                          is_active: event.target.checked,
                        })
                      }
                    />
                    노출
                  </label>

                  <button
                    type="button"
                    onClick={() => void deleteCategory(category)}
                    disabled={saving}
                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-5">
          <div className="sticky top-0 z-20 rounded-3xl border border-[#E8DED1] bg-[#F8F3EC]/95 py-3 backdrop-blur">
            <div className="flex gap-2 overflow-x-auto px-1 pb-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("all")}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                  selectedCategoryId === "all"
                    ? "bg-[#172033] text-white"
                    : "bg-white text-[#172033]"
                }`}
              >
                전체 {items.length}
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                    selectedCategoryId === category.id
                      ? "bg-[#172033] text-white"
                      : "bg-white text-[#172033]"
                  }`}
                >
                  {category.name} {itemCountByCategory[category.id] || 0}
                </button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="상품명 또는 설명 검색"
                className="w-full rounded-2xl border border-[#E8DED1] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#172033]"
              />

              <select
                value={newMenuCategoryId}
                onChange={(event) =>
                  setNewMenuCategoryId(
                    event.target.value
                      ? Number(event.target.value)
                      : "",
                  )
                }
                className="rounded-2xl border border-[#E8DED1] bg-white px-3 py-3 text-sm font-black outline-none"
              >
                <option value="">추가할 카테고리 선택</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => void addMenuItem()}
                disabled={saving || newMenuCategoryId === ""}
                className="rounded-2xl bg-[#B64032] px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                + 새 메뉴 추가
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border-2 border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black text-blue-950">배달 단가 일괄 계산</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-blue-700">
                  픽업 단가 기준으로 배달 단가를 퍼센트로 계산합니다.
                  적용 후 각 품목의 Delivery 금액은 개별 수정할 수 있습니다.
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label>
                  <span className="mb-1 block text-[10px] font-black text-blue-700">
                    배달 인상률
                  </span>
                  <div className="flex overflow-hidden rounded-xl border border-blue-300 bg-white">
                    <input
                      value={deliveryPercentInput}
                      onChange={(event) =>
                        setDeliveryPercentInput(
                          event.target.value.replace(/[^0-9.-]/g, ""),
                        )
                      }
                      inputMode="decimal"
                      className="w-20 px-3 py-2 text-right text-sm font-black outline-none"
                    />
                    <span className="flex items-center border-l border-blue-200 px-2 text-xs font-black text-blue-700">%</span>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => applyDeliveryPercent("filtered")}
                  className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-black text-blue-800"
                >
                  현재 표시 메뉴 적용
                </button>

                <button
                  type="button"
                  onClick={() => applyDeliveryPercent("all")}
                  className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white"
                >
                  전체 메뉴 적용
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {filteredItems.length === 0 ? (
              <div className="rounded-3xl bg-white p-6 text-center text-sm font-bold text-gray-500 shadow-sm">
                표시할 메뉴가 없습니다.
              </div>
            ) : (
              filteredItems.map((item) => {
                const imageUrl = item.thumbnail_url || item.image_url;

                return (
                  <article
                    id={`owner-menu-item-${item.id}`}
                    key={item.id}
                    className={`rounded-3xl bg-white p-4 shadow-sm ${
                      item.is_available ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="w-24 shrink-0">
                        <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-gray-100">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-3xl">
                              🍽️
                            </div>
                          )}

                          {uploadingItemId === item.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-2 text-center text-[10px] font-black text-white">
                              변환·등록 중
                            </div>
                          )}
                        </div>

                        <label
                          className={`mt-2 flex items-center justify-center rounded-lg px-2 py-2 text-[11px] font-black ${
                            uploadingItemId === item.id
                              ? "cursor-not-allowed bg-gray-200 text-gray-500"
                              : "cursor-pointer bg-[#172033] text-white"
                          }`}
                        >
                          {imageUrl
                            ? "이미지 변경"
                            : "+ 이미지 등록"}

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={
                              uploadingItemId === item.id
                            }
                            className="hidden"
                            onChange={(event) => {
                              const file =
                                event.target.files?.[0];

                              event.currentTarget.value = "";

                              if (file) {
                                void uploadItemImage(
                                  item.id,
                                  file,
                                );
                              }
                            }}
                          />
                        </label>

                        {imageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              void removeItemImage(item.id)
                            }
                            disabled={
                              uploadingItemId === item.id
                            }
                            className="mt-1 w-full rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-black text-red-600 disabled:opacity-50"
                          >
                            이미지 삭제
                          </button>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <input
                          value={item.name}
                          onChange={(event) =>
                            updateItem(item.id, {
                              name: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base font-black outline-none focus:border-[#172033]"
                        />

                        <textarea
                          value={item.description || ""}
                          onChange={(event) =>
                            updateItem(item.id, {
                              description: event.target.value,
                            })
                          }
                          placeholder="상품 설명"
                          rows={2}
                          className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-[#172033]"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_110px_110px_110px_80px_auto]">
                      <select
                        value={item.category_id ?? ""}
                        onChange={(event) =>
                          updateItem(item.id, {
                            category_id: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none"
                      >
                        <option value="">카테고리 없음</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>

                      <label className="rounded-xl border border-gray-200 bg-white px-2 py-1">
                        <span className="block text-[9px] font-black uppercase text-gray-500">Menu</span>
                        <div className="flex items-center">
                          <span className="mr-1 text-xs font-black text-gray-500">$</span>
                          <input
                            value={priceInputs[item.id] ?? ""}
                            onChange={(event) =>
                              setPriceInputs((current) => ({
                                ...current,
                                [item.id]: cleanPrice(event.target.value),
                              }))
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                            className="min-w-0 w-full bg-transparent py-1 text-sm font-black outline-none"
                          />
                        </div>
                      </label>

                      <label className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1">
                        <span className="block text-[9px] font-black uppercase text-emerald-700">Pickup</span>
                        <div className="flex items-center">
                          <span className="mr-1 text-xs font-black text-emerald-700">$</span>
                          <input
                            value={pickupPriceInputs[item.id] ?? ""}
                            onChange={(event) =>
                              setPickupPriceInputs((current) => ({
                                ...current,
                                [item.id]: cleanPrice(event.target.value),
                              }))
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                            className="min-w-0 w-full bg-transparent py-1 text-sm font-black text-emerald-950 outline-none"
                          />
                        </div>
                      </label>

                      <label className="rounded-xl border border-orange-200 bg-orange-50 px-2 py-1">
                        <span className="block text-[9px] font-black uppercase text-orange-700">Delivery</span>
                        <div className="flex items-center">
                          <span className="mr-1 text-xs font-black text-orange-700">$</span>
                          <input
                            value={deliveryPriceInputs[item.id] ?? ""}
                            onChange={(event) =>
                              setDeliveryPriceInputs((current) => ({
                                ...current,
                                [item.id]: cleanPrice(event.target.value),
                              }))
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                            className="min-w-0 w-full bg-transparent py-1 text-sm font-black text-orange-950 outline-none"
                          />
                        </div>
                      </label>

                      <input
                        type="number"
                        value={item.display_order ?? 999}
                        onChange={(event) =>
                          updateItem(item.id, {
                            display_order: Number(event.target.value),
                          })
                        }
                        title="노출 순서"
                        className="rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-black outline-none"
                      />

                      <label className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={item.is_available}
                          onChange={(event) =>
                            updateItem(item.id, {
                              is_available: event.target.checked,
                            })
                          }
                        />
                        판매
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEE5DA] pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveMenuItem(item, -1)}
                          className="rounded-xl border border-[#E8DED1] bg-white px-3 py-2 text-xs font-black"
                          title="같은 카테고리에서 메뉴를 위로 이동"
                        >
                          ↑ 메뉴
                        </button>

                        <button
                          type="button"
                          onClick={() => moveMenuItem(item, 1)}
                          className="rounded-xl border border-[#E8DED1] bg-white px-3 py-2 text-xs font-black"
                          title="같은 카테고리에서 메뉴를 아래로 이동"
                        >
                          ↓ 메뉴
                        </button>

                        <button
                          type="button"
                          onClick={() => void duplicateMenuItem(item)}
                          disabled={saving}
                          className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 disabled:opacity-40"
                        >
                          복제
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteMenuItem(item)}
                          disabled={saving}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-40"
                        >
                          메뉴 삭제
                        </button>
                      </div>

                      <div className="text-xs font-bold text-gray-500">
                        옵션 그룹 {normalizeOptionGroups(item).length}개
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addOptionGroup(item.id)}
                          className="rounded-xl border border-[#D7C9B9] bg-white px-3 py-2 text-xs font-black"
                        >
                          + 옵션 그룹
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleOptionManager(item.id)}
                          className={`rounded-xl px-3 py-2 text-xs font-black ${
                            expandedOptionItemIds.has(item.id)
                              ? "bg-[#B64032] text-white"
                              : "bg-[#172033] text-white"
                          }`}
                        >
                          {expandedOptionItemIds.has(item.id)
                            ? "옵션 관리 닫기 ▲"
                            : "⚙ 옵션 관리 ▼"}
                        </button>
                      </div>
                    </div>

                    {expandedOptionItemIds.has(item.id) && (
                      <div className="mt-3 space-y-3 rounded-2xl border border-[#E8DED1] bg-[#FBF8F4] p-3 sm:p-4">
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                          <p className="text-xs font-black text-blue-900">
                            공용 옵션에서 불러오기
                          </p>

                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                            <select
                              value={selectedTemplateByItem[item.id] || ""}
                              onChange={(event) =>
                                setSelectedTemplateByItem((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black outline-none"
                            >
                              <option value="">공용 옵션 선택</option>
                              {optionTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() =>
                                applyOptionTemplateToItem(item.id)
                              }
                              disabled={
                                !selectedTemplateByItem[item.id] ||
                                optionTemplates.length === 0
                              }
                              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                            >
                              선택 옵션 추가
                            </button>
                          </div>
                        </div>

                        {normalizeOptionGroups(item).length === 0 ? (
                          <div className="rounded-xl bg-white p-4 text-center text-xs font-bold text-gray-500">
                            옵션 그룹이 없습니다. “+ 옵션 그룹”을 눌러 추가하세요.
                          </div>
                        ) : (
                          normalizeOptionGroups(item).map(
                            (group, groupIndex, allGroups) => (
                              <div
                                key={`${item.id}-group-${groupIndex}`}
                                className="rounded-2xl border border-[#E8DED1] bg-white p-3 shadow-sm"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <input
                                    value={group.name}
                                    onChange={(event) =>
                                      updateOptionGroup(
                                        item.id,
                                        groupIndex,
                                        { name: event.target.value },
                                      )
                                    }
                                    placeholder="옵션 그룹 이름"
                                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-black outline-none focus:border-[#172033]"
                                  />

                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      disabled={groupIndex === 0}
                                      onClick={() =>
                                        moveOptionGroup(
                                          item.id,
                                          groupIndex,
                                          -1,
                                        )
                                      }
                                      className="rounded-lg border px-2 py-2 text-xs font-black disabled:opacity-30"
                                      title="그룹 위로"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        groupIndex === allGroups.length - 1
                                      }
                                      onClick={() =>
                                        moveOptionGroup(
                                          item.id,
                                          groupIndex,
                                          1,
                                        )
                                      }
                                      className="rounded-lg border px-2 py-2 text-xs font-black disabled:opacity-30"
                                      title="그룹 아래로"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        saveGroupAsTemplate(item, group)
                                      }
                                      className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
                                    >
                                      공용 옵션 저장
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteOptionGroup(
                                          item.id,
                                          groupIndex,
                                        )
                                      }
                                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                                    >
                                      그룹 삭제
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-[auto_120px_120px_1fr]">
                                  <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-black">
                                    <input
                                      type="checkbox"
                                      checked={group.required}
                                      onChange={(event) => {
                                        const required =
                                          event.target.checked;

                                        updateOptionGroup(
                                          item.id,
                                          groupIndex,
                                          {
                                            required,
                                            minSelect: required
                                              ? Math.max(
                                                  1,
                                                  group.minSelect,
                                                )
                                              : 0,
                                          },
                                        );
                                      }}
                                    />
                                    Required
                                  </label>

                                  <label className="rounded-xl border border-gray-200 bg-white px-2 py-1">
                                    <span className="block text-[10px] font-black text-gray-500">
                                      최소 선택
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={group.minSelect}
                                      onChange={(event) =>
                                        updateOptionGroup(
                                          item.id,
                                          groupIndex,
                                          {
                                            minSelect: Math.max(
                                              0,
                                              Math.floor(
                                                Number(
                                                  event.target.value,
                                                ) || 0,
                                              ),
                                            ),
                                          },
                                        )
                                      }
                                      className="w-full bg-transparent text-sm font-black outline-none"
                                    />
                                  </label>

                                  <label className="rounded-xl border border-gray-200 bg-white px-2 py-1">
                                    <span className="block text-[10px] font-black text-gray-500">
                                      최대 선택
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={
                                        group.maxSelect == null
                                          ? ""
                                          : group.maxSelect
                                      }
                                      placeholder="제한 없음"
                                      onChange={(event) =>
                                        updateOptionGroup(
                                          item.id,
                                          groupIndex,
                                          {
                                            maxSelect:
                                              event.target.value === ""
                                                ? null
                                                : Math.max(
                                                    0,
                                                    Math.floor(
                                                      Number(
                                                        event.target.value,
                                                      ) || 0,
                                                    ),
                                                  ),
                                          },
                                        )
                                      }
                                      className="w-full bg-transparent text-sm font-black outline-none"
                                    />
                                  </label>

                                  <div className="flex items-center rounded-xl bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700">
                                    {group.minSelect === 1 &&
                                    group.maxSelect === 1
                                      ? "단일 선택 → 주문화면에서 라디오 버튼"
                                      : group.maxSelect != null
                                        ? `그룹 전체 최대 ${group.maxSelect}개`
                                        : "최대 선택 제한 없음"}
                                  </div>
                                </div>

                                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                                  {group.options.length === 0 ? (
                                    <div className="bg-gray-50 px-3 py-4 text-center text-xs font-bold text-gray-500">
                                      옵션이 없습니다.
                                    </div>
                                  ) : (
                                    group.options.map(
                                      (
                                        option,
                                        optionIndex,
                                        allOptions,
                                      ) => (
                                        <div
                                          key={`${item.id}-${groupIndex}-${optionIndex}`}
                                          className="grid gap-2 border-b border-gray-100 p-2 last:border-b-0 sm:grid-cols-[1fr_120px_155px_auto_auto]"
                                        >
                                          <input
                                            value={option.name}
                                            onChange={(event) =>
                                              updateOption(
                                                item.id,
                                                groupIndex,
                                                optionIndex,
                                                {
                                                  name: event.target.value,
                                                },
                                              )
                                            }
                                            placeholder="옵션 이름"
                                            className="min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold outline-none focus:border-[#172033]"
                                          />

                                          <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black text-gray-500">
                                              +$
                                            </span>
                                            <input
                                              key={`${item.id}-${groupIndex}-${optionIndex}-price-${option.priceDelta}`}
                                              type="text"
                                              inputMode="decimal"
                                              defaultValue={String(option.priceDelta ?? 0)}
                                              onInput={(event) => {
                                                const input = event.currentTarget;
                                                const cleaned = cleanPrice(input.value);
                                                if (input.value !== cleaned) input.value = cleaned;
                                              }}
                                              onBlur={(event) => {
                                                const cleaned = cleanPrice(event.currentTarget.value);
                                                const priceDelta = cleaned === "" || cleaned === "."
                                                  ? 0
                                                  : Number(cleaned);
                                                const normalized = Number.isFinite(priceDelta)
                                                  ? Math.max(0, Number(priceDelta.toFixed(2)))
                                                  : 0;
                                                updateOption(
                                                  item.id,
                                                  groupIndex,
                                                  optionIndex,
                                                  { priceDelta: normalized },
                                                );
                                                event.currentTarget.value = String(normalized);
                                              }}
                                              className="w-full rounded-lg border border-gray-200 py-2 pl-7 pr-2 text-xs font-black outline-none"
                                            />
                                          </div>

                                          <select
                                            value={Math.max(
                                              0,
                                              optionCategoryNames.findIndex(
                                                (name) =>
                                                  name.trim().toLowerCase() ===
                                                  group.name.trim().toLowerCase(),
                                              ),
                                            )}
                                            onChange={(event) =>
                                              moveMenuOptionToCategory(
                                                item.id,
                                                groupIndex,
                                                optionIndex,
                                                Number(event.target.value),
                                              )
                                            }
                                            title="옵션 카테고리 이동"
                                            className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-[11px] font-black text-blue-900 outline-none"
                                          >
                                            {optionCategoryNames.map(
                                              (name, categoryIndex) => (
                                                <option
                                                  key={`${item.id}-${groupIndex}-${optionIndex}-category-${categoryIndex}`}
                                                  value={categoryIndex}
                                                >
                                                  {name ||
                                                    `Option ${categoryIndex + 1}`}
                                                </option>
                                              ),
                                            )}
                                          </select>

                                          <label className="flex items-center justify-center gap-1 rounded-lg bg-gray-50 px-2 py-2 text-[10px] font-black">
                                            <input
                                              type="checkbox"
                                              checked={option.soldOut}
                                              onChange={(event) =>
                                                updateOption(
                                                  item.id,
                                                  groupIndex,
                                                  optionIndex,
                                                  {
                                                    soldOut:
                                                      event.target.checked,
                                                  },
                                                )
                                              }
                                            />
                                            Sold Out
                                          </label>

                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              disabled={optionIndex === 0}
                                              onClick={() =>
                                                moveOption(
                                                  item.id,
                                                  groupIndex,
                                                  optionIndex,
                                                  -1,
                                                )
                                              }
                                              className="rounded-lg border px-2 text-xs font-black disabled:opacity-30"
                                              title="옵션 위로"
                                            >
                                              ↑
                                            </button>
                                            <button
                                              type="button"
                                              disabled={
                                                optionIndex ===
                                                allOptions.length - 1
                                              }
                                              onClick={() =>
                                                moveOption(
                                                  item.id,
                                                  groupIndex,
                                                  optionIndex,
                                                  1,
                                                )
                                              }
                                              className="rounded-lg border px-2 text-xs font-black disabled:opacity-30"
                                              title="옵션 아래로"
                                            >
                                              ↓
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                deleteOption(
                                                  item.id,
                                                  groupIndex,
                                                  optionIndex,
                                                );
                                              }}
                                              className="rounded-lg bg-red-50 px-2 text-xs font-black text-red-600"
                                            >
                                              삭제
                                            </button>
                                          </div>
                                        </div>
                                      ),
                                    )
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    addOption(item.id, groupIndex)
                                  }
                                  className="mt-3 w-full rounded-xl border border-dashed border-[#B9A995] bg-[#FBF8F4] px-3 py-2 text-xs font-black"
                                >
                                  + 옵션 추가
                                </button>
                              </div>
                            ),
                          )
                        )}

                        <button
                          type="button"
                          onClick={() => addOptionGroup(item.id)}
                          className="w-full rounded-xl bg-[#172033] px-4 py-3 text-xs font-black text-white"
                        >
                          + 새 옵션 그룹 추가
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8DED1] bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl gap-3">
          <button
            type="button"
            onClick={() => void loadMenu()}
            disabled={saving}
            className="rounded-xl border border-[#E8DED1] px-4 py-3 text-sm font-black disabled:opacity-50"
          >
            다시 불러오기
          </button>

          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={saving}
            className="flex-1 rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white shadow disabled:opacity-50"
          >
            {saving ? "저장 중..." : "카테고리 · 메뉴 · 옵션 전체 저장"}
          </button>
        </div>
      </div>
    </main>
  );
}