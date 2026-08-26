"use client";


import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";

const MARKET_CATEGORIES = [
  "가구",
  "전자제품",
  "골프용품",
  "자동차",
  "아기용품",
  "의류",
  "생활용품",
  "식품",
  "무료나눔",
  "구인구직",
  "기타",
];

const CONDITIONS = [
  "새것",
  "거의 새것",
  "중고",
  "고장/수리필요",
];

const MAX_ITEMS = 20;
const MAX_IMAGES_PER_INDIVIDUAL_ITEM = 6;
const MAX_IMAGES_PER_BUNDLE_ITEM = 3;

type RegistrationMode =
  | "individual"
  | "bundle";

type MarketItemForm = {
  localId: string;
  title: string;
  price: string;
  category: string;
  condition: string;
  description: string;
  imageFiles: File[];
};

function createEmptyItem(): MarketItemForm {
  return {
    localId: crypto.randomUUID(),
    title: "",
    price: "",
    category: MARKET_CATEGORIES[0],
    condition: CONDITIONS[2],
    description: "",
    imageFiles: [],
  };
}

function ImagePreview({
  file,
  alt,
}: {
  file: File;
  alt: string;
}) {
  const [previewUrl, setPreviewUrl] =
    useState("");

  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();

    reader.onload = () => {
      if (
        cancelled ||
        typeof reader.result !== "string"
      ) {
        return;
      }

      setPreviewUrl(reader.result);
    };

    reader.onerror = () => {
      if (!cancelled) {
        setPreviewUrl("");
      }
    };

    reader.readAsDataURL(file);

    return () => {
      cancelled = true;

      if (
        reader.readyState ===
        FileReader.LOADING
      ) {
        reader.abort();
      }
    };
  }, [file]);

  if (!previewUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 px-2 text-center text-xs font-bold text-gray-400">
        이미지 불러오는 중...
      </div>
    );
  }

  return (
    <img
      src={previewUrl}
      alt={alt}
      className="h-full w-full object-cover"
    />
  );
}

export default function NewMarketItemPage() {
  const router = useRouter();

  const [
    registrationMode,
    setRegistrationMode,
  ] = useState<RegistrationMode>(
    "individual",
  );

  const [location, setLocation] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [items, setItems] = useState<
    MarketItemForm[]
  >([createEmptyItem()]);

  const [uploading, setUploading] =
    useState(false);

  const [authChecking, setAuthChecking] =
    useState(true);

  const [loggedIn, setLoggedIn] =
    useState(false);

  const currentMaxImages =
    registrationMode === "bundle"
      ? MAX_IMAGES_PER_BUNDLE_ITEM
      : MAX_IMAGES_PER_INDIVIDUAL_ITEM;

  useEffect(() => {
    let mounted = true;

    async function checkLogin() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !user) {
  alert("상품을 등록하려면 로그인이 필요합니다.");
  router.back();
  return;
}

      setLoggedIn(true);
      setAuthChecking(false);
    }

    checkLogin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
  setLoggedIn(false);
  setAuthChecking(false);

  alert("로그인이 필요합니다.");

  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace("/market");
  }

  return;
} else {
  setLoggedIn(true);
  setAuthChecking(false);
}
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);


  const MAX_IMAGE_SIZE = 1280;
  const IMAGE_QUALITY = 0.8;

  const THUMBNAIL_WIDTH = 480;
  const THUMBNAIL_HEIGHT = 360;
  const THUMBNAIL_QUALITY = 0.76;

  async function optimizeImage(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) {
      return file;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error(`이미지를 불러올 수 없습니다: ${file.name}`));
        img.src = objectUrl;
      });

      const originalWidth = image.naturalWidth;
      const originalHeight = image.naturalHeight;

      if (!originalWidth || !originalHeight) {
        return file;
      }

      const scale = Math.min(
        1,
        MAX_IMAGE_SIZE / Math.max(originalWidth, originalHeight),
      );

      const width = Math.max(1, Math.round(originalWidth * scale));
      const height = Math.max(1, Math.round(originalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        return file;
      }

      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", IMAGE_QUALITY);
      });

      if (!blob) {
        return file;
      }

      const baseName =
        file.name.replace(/\.[^/.]+$/, "").trim() || "market-image";

      return new File([blob], `${baseName}.webp`, {
        type: "image/webp",
        lastModified: Date.now(),
      });
    } catch (error) {
      console.warn("이미지 축소 실패, 원본으로 업로드합니다.", error);
      return file;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }


  async function createMarketThumbnail(
    file: File,
  ): Promise<Blob> {
    const objectUrl =
      URL.createObjectURL(file);

    try {
      const image =
        await new Promise<HTMLImageElement>(
          (resolve, reject) => {
            const img = new Image();

            img.onload = () =>
              resolve(img);

            img.onerror = () =>
              reject(
                new Error(
                  `대표 이미지를 불러올 수 없습니다: ${file.name}`,
                ),
              );

            img.src = objectUrl;
          },
        );

      const sourceWidth =
        image.naturalWidth;

      const sourceHeight =
        image.naturalHeight;

      if (
        !sourceWidth ||
        !sourceHeight
      ) {
        throw new Error(
          "대표 이미지 크기를 확인할 수 없습니다.",
        );
      }

      const sourceRatio =
        sourceWidth /
        sourceHeight;

      const targetRatio =
        THUMBNAIL_WIDTH /
        THUMBNAIL_HEIGHT;

      let sourceX = 0;
      let sourceY = 0;
      let cropWidth =
        sourceWidth;
      let cropHeight =
        sourceHeight;

      if (
        sourceRatio >
        targetRatio
      ) {
        cropWidth =
          sourceHeight *
          targetRatio;

        sourceX =
          (sourceWidth -
            cropWidth) /
          2;
      } else {
        cropHeight =
          sourceWidth /
          targetRatio;

        sourceY =
          (sourceHeight -
            cropHeight) /
          2;
      }

      const canvas =
        document.createElement(
          "canvas",
        );

      canvas.width =
        THUMBNAIL_WIDTH;

      canvas.height =
        THUMBNAIL_HEIGHT;

      const context =
        canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "썸네일 Canvas를 만들 수 없습니다.",
        );
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        0,
        0,
        THUMBNAIL_WIDTH,
        THUMBNAIL_HEIGHT,
      );

      const blob =
        await new Promise<Blob | null>(
          (resolve) => {
            canvas.toBlob(
              resolve,
              "image/webp",
              THUMBNAIL_QUALITY,
            );
          },
        );

      if (!blob) {
        throw new Error(
          "썸네일 파일 생성에 실패했습니다.",
        );
      }

      return blob;
    } finally {
      URL.revokeObjectURL(
        objectUrl,
      );
    }
  }

  async function uploadMarketThumbnail(
    marketItemId: number,
    sourceFile: File,
  ) {
    const thumbnailBlob =
      await createMarketThumbnail(
        sourceFile,
      );

    const filePath =
      `market-${marketItemId}/thumbnail.webp`;

    const { error: uploadError } =
      await supabase.storage
        .from(
          "market-thumbnails",
        )
        .upload(
          filePath,
          thumbnailBlob,
          {
            cacheControl:
              "31536000",
            contentType:
              "image/webp",
            upsert: true,
          },
        );

    if (uploadError) {
      throw uploadError;
    }

    const { data } =
      supabase.storage
        .from(
          "market-thumbnails",
        )
        .getPublicUrl(
          filePath,
        );

    const thumbnailUrl =
      `${data.publicUrl}?v=${Date.now()}`;

    const { error: updateError } =
      await supabase
        .from("market_items")
        .update({
          thumbnail_url:
            thumbnailUrl,
        })
        .eq(
          "id",
          marketItemId,
        );

    if (updateError) {
      throw updateError;
    }

    return thumbnailUrl;
  }

  async function uploadMarketImage(
    userId: string,
    itemId: string,
    file: File,
    imageIndex: number,
  ) {
    const safeName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );

    const filePath = [
      userId,
      "images",
      itemId,
      `${Date.now()}-${imageIndex}-${safeName}`,
    ].join("/");

    const { error } =
      await supabase.storage
        .from("market")
        .upload(filePath, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type,
        });

    if (error) throw error;

    const { data } =
      supabase.storage
        .from("market")
        .getPublicUrl(filePath);

    return data.publicUrl;
  }

  function updateItem<
    K extends keyof MarketItemForm,
  >(
    localId: string,
    field: K,
    value: MarketItemForm[K],
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function changeRegistrationMode(
    mode: RegistrationMode,
  ) {
    if (uploading) return;
    if (mode === registrationMode) return;

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        imageFiles:
          mode === "bundle"
            ? item.imageFiles.slice(
                0,
                MAX_IMAGES_PER_BUNDLE_ITEM,
              )
            : item.imageFiles.slice(
                0,
                MAX_IMAGES_PER_INDIVIDUAL_ITEM,
              ),
      })),
    );

    setRegistrationMode(mode);
  }

  function addItem() {
    if (uploading) return;

    if (items.length >= MAX_ITEMS) {
      alert(
        `상품은 한 번에 최대 ${MAX_ITEMS}개까지 등록할 수 있습니다.`,
      );
      return;
    }

    setItems((prev) => [
      ...prev,
      createEmptyItem(),
    ]);
  }

  function removeItem(localId: string) {
    if (uploading) return;

    if (items.length === 1) {
      alert(
        "최소 한 개의 상품이 필요합니다.",
      );
      return;
    }

    setItems((prev) =>
      prev.filter(
        (item) =>
          item.localId !== localId,
      ),
    );
  }

  function moveItem(
    index: number,
    direction: "up" | "down",
  ) {
    if (uploading) return;

    setItems((prev) => {
      const next = [...prev];

      const targetIndex =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= next.length
      ) {
        return prev;
      }

      [
        next[index],
        next[targetIndex],
      ] = [
        next[targetIndex],
        next[index],
      ];

      return next;
    });
  }

  function addImageFiles(
    localId: string,
    files: File[],
  ) {
    const onlyImages = files.filter(
      (file) =>
        file.type.startsWith("image/"),
    );

    if (onlyImages.length === 0) {
      alert(
        "이미지 파일만 선택할 수 있습니다.",
      );
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (
          item.localId !== localId
        ) {
          return item;
        }

        const remaining =
          currentMaxImages -
          item.imageFiles.length;

        if (remaining <= 0) {
          alert(
            registrationMode ===
              "bundle"
              ? `묶음 등록에서는 상품마다 사진을 최대 ${MAX_IMAGES_PER_BUNDLE_ITEM}장까지 등록할 수 있습니다.`
              : `개별 등록에서는 상품마다 사진을 최대 ${MAX_IMAGES_PER_INDIVIDUAL_ITEM}장까지 등록할 수 있습니다.`,
          );

          return item;
        }

        // 사용자가 한 번에 제한보다 많은 사진을 선택해도
        // 실제 상태에는 남은 개수까지만 들어가도록 강제로 제한합니다.
        // 예: 개별 등록에서 8장을 선택해도 최대 6장만 저장됩니다.
        const filesToAdd =
          onlyImages.slice(
            0,
            remaining,
          );

        if (
          onlyImages.length > remaining
        ) {
          alert(
            registrationMode ===
              "bundle"
              ? `사진은 최대 ${MAX_IMAGES_PER_BUNDLE_ITEM}장까지 선택할 수 있습니다. 초과한 사진은 추가되지 않았습니다.`
              : `사진은 최대 ${MAX_IMAGES_PER_INDIVIDUAL_ITEM}장까지 선택할 수 있습니다. 초과한 사진은 추가되지 않았습니다.`,
          );
        }

        return {
          ...item,
          imageFiles: [
            ...item.imageFiles,
            ...filesToAdd,
          ],
        };
      }),
    );
  }

  function removeImage(
    localId: string,
    imageIndex: number,
  ) {
    if (uploading) return;

    setItems((prev) =>
      prev.map((item) => {
        if (
          item.localId !== localId
        ) {
          return item;
        }

        return {
          ...item,
          imageFiles:
            item.imageFiles.filter(
              (_, index) =>
                index !== imageIndex,
            ),
        };
      }),
    );
  }

  function validateItems() {
    if (!location.trim()) {
      alert(
        "거래 지역을 입력하세요.",
      );
      return false;
    }

    if (
      !phone.trim() &&
      !email.trim()
    ) {
      alert(
        "전화번호 또는 이메일 중 하나는 입력해주세요.",
      );
      return false;
    }

    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const item = items[index];

      if (!item.title.trim()) {
        alert(
          `${index + 1}번 상품의 제목을 입력하세요.`,
        );
        return false;
      }

      if (
        item.price.trim() &&
        Number.isNaN(
          Number(item.price),
        )
      ) {
        alert(
          `${index + 1}번 상품의 가격을 숫자로 입력하세요.`,
        );
        return false;
      }

      if (
        item.imageFiles.length === 0
      ) {
        alert(
          `${index + 1}번 상품의 사진을 한 장 이상 선택하세요.`,
        );
        return false;
      }

      if (
        item.imageFiles.length >
        currentMaxImages
      ) {
        alert(
          `${index + 1}번 상품 사진은 최대 ${currentMaxImages}장입니다.`,
        );
        return false;
      }
    }

    return true;
  }

  async function submitItems() {
    if (uploading) return;

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (
      userError ||
      !userData.user
    ) {
      alert(
        "로그인이 필요합니다.",
      );

      router.push(
        `/login?redirect=${encodeURIComponent(
          "/market/new",
        )}`,
      );

      return;
    }

    if (!validateItems()) return;

    setUploading(true);

    try {
      const rowsToInsert = [];

      const thumbnailSources: Array<{
        firstImageUrl: string;
        sourceFile: File;
      }> = [];

      // 묶음 등록을 선택한 경우 이번 등록에 포함된 모든 상품에
      // 동일한 bundle_id를 저장합니다.
      const bundleId =
        registrationMode === "bundle"
          ? crypto.randomUUID()
          : null;

      for (
        let itemIndex = 0;
        itemIndex < items.length;
        itemIndex++
      ) {
        const item =
          items[itemIndex];

        const uploadedImageUrls: string[] =
          [];

        for (
          let imageIndex = 0;
          imageIndex <
          item.imageFiles.length;
          imageIndex++
        ) {
          const originalFile =
            item.imageFiles[
              imageIndex
            ];

          const optimizedFile =
            await optimizeImage(
              originalFile,
            );

          const imageUrl =
            await uploadMarketImage(
              userData.user.id,
              item.localId,
              optimizedFile,
              imageIndex,
            );

          uploadedImageUrls.push(
            imageUrl,
          );
        }

        if (
          uploadedImageUrls[0] &&
          item.imageFiles[0]
        ) {
          thumbnailSources.push({
            firstImageUrl:
              uploadedImageUrls[0],
            sourceFile:
              item.imageFiles[0],
          });
        }

        rowsToInsert.push({
          seller_id:
            userData.user.id,

          title:
            item.title.trim(),

          price:
            item.price.trim()
              ? Number(item.price)
              : 0,

          category:
            item.category,

          condition:
            item.condition,

          location:
            location.trim(),

          phone:
            phone.trim() ||
            null,

          email:
            email
              .trim()
              .toLowerCase() ||
            null,

          description:
            item.description.trim() ||
            null,

          images:
            uploadedImageUrls,

          video_url:
            null,

          status:
            "available",

          listing_type:
            registrationMode,

          bundle_id:
            bundleId,
        });
      }

      const {
        data: insertedItems,
        error: insertError,
      } = await supabase
        .from("market_items")
        .insert(rowsToInsert)
        .select(
          "id, images",
        );

      if (insertError) {
        throw insertError;
      }

      const thumbnailSourceMap =
        new Map(
          thumbnailSources.map(
            (source) => [
              source.firstImageUrl,
              source.sourceFile,
            ],
          ),
        );

      for (
        const insertedItem of
          insertedItems || []
      ) {
        const insertedImages =
          Array.isArray(
            insertedItem.images,
          )
            ? insertedItem.images
            : [];

        const firstImageUrl =
          typeof insertedImages[0] ===
          "string"
            ? insertedImages[0]
            : "";

        const sourceFile =
          thumbnailSourceMap.get(
            firstImageUrl,
          );

        if (!sourceFile) {
          continue;
        }

        try {
          await uploadMarketThumbnail(
            Number(
              insertedItem.id,
            ),
            sourceFile,
          );
        } catch (
          thumbnailError
        ) {
          console.error(
            `마켓 상품 ${insertedItem.id} 썸네일 생성 실패:`,
            thumbnailError,
          );
        }
      }

      alert(
        registrationMode ===
          "bundle"
          ? `${items.length}개의 묶음 상품이 각각 별도 게시물로 등록되었습니다.`
          : `${items.length}개의 상품이 각각 등록되었습니다.`,
      );

      router.push("/market");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";

      alert(
        "등록 실패: " + message,
      );
    } finally {
      setUploading(false);
    }
  }

  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white px-8 py-10 text-center shadow">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#172033]" />

          <p className="mt-5 text-lg font-black text-[#172033]">
            로그인 확인 중...
          </p>

          <p className="mt-2 text-sm text-gray-500">
            잠시만 기다려 주세요.
          </p>
        </div>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white px-8 py-10 text-center shadow">
          <div className="text-4xl">
            🔒
          </div>

          <p className="mt-4 text-lg font-black text-[#172033]">
            로그인이 필요합니다
          </p>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            상품 등록은 로그인한 회원만 가능합니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-4 py-4 pb-28">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 rounded-3xl bg-white p-5 shadow">
          <div className="relative flex h-10 items-center border-b border-[#E8DED1] pb-3">
            <BackButton />

            <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl font-black text-[#172033]">
              {registrationMode ===
              "bundle"
                ? "묶음 사진 등록"
                : "개별 사진 등록"}
            </h1>

            <div className="ml-auto">
              <ProfileButton />
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-1 text-base font-black text-[#172033]">
            등록 방식
          </h2>

          <p className="mb-4 text-xs leading-5 text-gray-500">
            개별 등록 또는 묶음 등록 방식을 선택하세요.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() =>
                changeRegistrationMode(
                  "individual",
                )
              }
              className={`rounded-2xl border-2 px-3 py-4 text-sm font-black transition disabled:opacity-50 ${
                registrationMode ===
                "individual"
                  ? "border-[#172033] bg-[#172033] text-white"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              개별 사진 등록

              <span className="mt-1 block text-[11px] font-medium opacity-75">
                기존 등록 방식
              </span>
            </button>

            <button
              type="button"
              disabled={uploading}
              onClick={() =>
                changeRegistrationMode(
                  "bundle",
                )
              }
              className={`rounded-2xl border-2 px-3 py-4 text-sm font-black transition disabled:opacity-50 ${
                registrationMode ===
                "bundle"
                  ? "border-[#172033] bg-[#172033] text-white"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              묶음 사진 등록

              <span className="mt-1 block text-[11px] font-medium opacity-75">
                상품별 사진 최대 3장
              </span>
            </button>
          </div>

          <div
            className={`mt-4 rounded-2xl p-3 text-xs font-bold leading-5 ${
              registrationMode ===
              "bundle"
                ? "bg-purple-50 text-purple-700"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {registrationMode ===
            "bundle"
              ? "상품별로 제목, 가격, 카테고리, 상태, 설명과 사진을 최대 3장까지 입력합니다. 등록된 상품은 각각 별도 게시물로 저장됩니다."
              : `기존 개별 등록 방식입니다. 상품마다 사진을 최대 ${MAX_IMAGES_PER_INDIVIDUAL_ITEM}장까지 등록할 수 있습니다.`}
          </div>
        </div>

        <div className="mb-4 rounded-3xl bg-white p-5 shadow">
          <div className="rounded-2xl bg-[#F8F3EC] p-4">
            <h2 className="mb-1 text-base font-black text-[#172033]">
              판매자 공통 정보
            </h2>

            <p className="mb-4 text-xs leading-5 text-gray-500">
              아래 정보는 등록하는 모든 상품에 동일하게 적용됩니다.
              <br />

              <span className="font-semibold text-[#C2410C]">
                전화번호 또는 이메일 중 하나는 반드시 입력해주세요.
              </span>
            </p>

            <input
              className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
              placeholder="거래 지역 (예: Raleigh, Cary)"
              value={location}
              onChange={(event) =>
                setLocation(
                  event.target.value,
                )
              }
            />

            <input
              className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
              placeholder="전화번호 (선택)"
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
            />

            <input
              className="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
              type="email"
              placeholder="이메일 (선택)"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
            />
          </div>
        </div>

        <div className="space-y-4">
          {items.map(
            (
              item,
              itemIndex,
            ) => (
              <section
                key={item.localId}
                className="overflow-hidden rounded-3xl bg-white shadow"
              >
                <div className="flex items-center justify-between bg-[#172033] px-4 py-3 text-white">
                  <div>
                    <p className="text-xs font-bold text-white/70">
                      ITEM{" "}
                      {itemIndex + 1}
                    </p>

                    <h2 className="text-lg font-black">
                      {item.title.trim() ||
                        `상품 ${
                          itemIndex +
                          1
                        }`}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={
                        itemIndex ===
                          0 ||
                        uploading
                      }
                      onClick={() =>
                        moveItem(
                          itemIndex,
                          "up",
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-black disabled:opacity-30"
                      aria-label="상품 위로 이동"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      disabled={
                        itemIndex ===
                          items.length -
                            1 ||
                        uploading
                      }
                      onClick={() =>
                        moveItem(
                          itemIndex,
                          "down",
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-black disabled:opacity-30"
                      aria-label="상품 아래로 이동"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      disabled={
                        items.length ===
                          1 ||
                        uploading
                      }
                      onClick={() =>
                        removeItem(
                          item.localId,
                        )
                      }
                      className="ml-1 rounded-full bg-red-500 px-3 py-2 text-xs font-black disabled:opacity-30"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <input
                    className="mb-3 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-[#172033]"
                    placeholder="상품 제목"
                    value={item.title}
                    onChange={(
                      event,
                    ) =>
                      updateItem(
                        item.localId,
                        "title",
                        event.target
                          .value,
                      )
                    }
                  />

                  <input
                    className="mb-3 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-[#172033]"
                    placeholder="가격 예: 100"
                    inputMode="decimal"
                    value={item.price}
                    onChange={(
                      event,
                    ) =>
                      updateItem(
                        item.localId,
                        "price",
                        event.target
                          .value,
                      )
                    }
                  />

                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <select
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
                      value={
                        item.category
                      }
                      onChange={(
                        event,
                      ) =>
                        updateItem(
                          item.localId,
                          "category",
                          event.target
                            .value,
                        )
                      }
                    >
                      {MARKET_CATEGORIES.map(
                        (
                          category,
                        ) => (
                          <option
                            key={
                              category
                            }
                            value={
                              category
                            }
                          >
                            {
                              category
                            }
                          </option>
                        ),
                      )}
                    </select>

                    <select
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
                      value={
                        item.condition
                      }
                      onChange={(
                        event,
                      ) =>
                        updateItem(
                          item.localId,
                          "condition",
                          event.target
                            .value,
                        )
                      }
                    >
                      {CONDITIONS.map(
                        (
                          condition,
                        ) => (
                          <option
                            key={
                              condition
                            }
                            value={
                              condition
                            }
                          >
                            {
                              condition
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <textarea
                    className="mb-3 h-32 w-full resize-none rounded-xl border border-gray-200 p-3 outline-none focus:border-[#172033]"
                    placeholder="상품 설명"
                    value={
                      item.description
                    }
                    onChange={(
                      event,
                    ) =>
                      updateItem(
                        item.localId,
                        "description",
                        event.target
                          .value,
                      )
                    }
                  />

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#172033]">
                          상품 사진
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          최대{" "}
                          {
                            currentMaxImages
                          }
                          장 · 첫 번째 사진이 대표사진입니다.
                          <br />
                          업로드 시 최대 1280px WebP로 자동 축소됩니다.
                        </p>
                      </div>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#172033]">
                        {
                          item
                            .imageFiles
                            .length
                        }
                        /
                        {
                          currentMaxImages
                        }
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <label
                        htmlFor={`market-images-${item.localId}`}
                        className={`inline-flex items-center rounded-xl px-4 py-3 text-sm font-black text-white ${
                          item
                            .imageFiles
                            .length >=
                            currentMaxImages ||
                          uploading
                            ? "cursor-not-allowed bg-gray-400"
                            : "cursor-pointer bg-[#172033]"
                        }`}
                      >
                        사진 첨부
                      </label>

                      <p className="text-xs font-bold text-gray-500">
                        한 번에 여러 장 선택 가능 · 최대 {currentMaxImages}장
                      </p>
                    </div>

                    <input
                      id={`market-images-${item.localId}`}
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={
                        uploading ||
                        item
                          .imageFiles
                          .length >=
                          currentMaxImages
                      }
                      className="hidden"
                      onChange={(
                        event,
                      ) => {
                        addImageFiles(
                          item.localId,
                          Array.from(
                            event
                              .target
                              .files ||
                              [],
                          ),
                        );

                        event.target.value =
                          "";
                      }}
                    />

                    {item.imageFiles
                      .length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {item.imageFiles.map(
                          (
                            file,
                            imageIndex,
                          ) => (
                            <div
                              key={`${file.name}-${file.lastModified}-${imageIndex}`}
                              className="relative aspect-square overflow-hidden rounded-2xl border bg-white"
                            >
                              <ImagePreview
                                file={
                                  file
                                }
                                alt={`상품 ${
                                  itemIndex +
                                  1
                                } 사진 ${
                                  imageIndex +
                                  1
                                }`}
                              />

                              <button
                                type="button"
                                disabled={
                                  uploading
                                }
                                onClick={() =>
                                  removeImage(
                                    item.localId,
                                    imageIndex,
                                  )
                                }
                                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-sm font-black text-white disabled:opacity-50"
                                aria-label="사진 삭제"
                              >
                                ×
                              </button>

                              <span
                                className={`absolute bottom-1 left-1 rounded-full px-2 py-1 text-[10px] font-black text-white ${
                                  imageIndex ===
                                  0
                                    ? "bg-green-600"
                                    : "bg-black/70"
                                }`}
                              >
                                {imageIndex ===
                                0
                                  ? "대표"
                                  : `${
                                      imageIndex +
                                      1
                                    }`}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ),
          )}
        </div>

        <button
          type="button"
          disabled={
            uploading ||
            items.length >=
              MAX_ITEMS
          }
          onClick={addItem}
          className="mt-4 w-full rounded-2xl border-2 border-dashed border-[#172033] bg-white py-4 font-black text-[#172033] disabled:opacity-40"
        >
          ＋ 상품 추가 (
          {items.length}/
          {MAX_ITEMS})
        </button>

        <div className="sticky bottom-20 z-20 mt-4 rounded-3xl bg-white p-3 shadow-lg">
          <button
            type="button"
            disabled={uploading}
            onClick={
              submitItems
            }
            className="w-full rounded-full bg-[#172033] py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? `${items.length}개 상품 등록 중...`
              : registrationMode ===
                  "bundle"
                ? `${items.length}개 묶음 상품 전체 등록하기`
                : `${items.length}개 상품 전체 등록하기`}
          </button>
        </div>
      </div>

      <CommunityBottomNav activeNav="market" />
    </main>
  );
}