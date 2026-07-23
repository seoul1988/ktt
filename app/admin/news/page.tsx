"use client";

import {
  Suspense,
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import RichTextEditor from "@/app/components/RichTextEditor";
import ProfileButton from "@/app/components/ProfileButton";
import { supabase } from "../../../lib/supabase";

type NewsAttachment = {
  name: string;
  url: string;
  path: string;
  type: string;
  size: number;
};

type NewsItem = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  images: string[] | null;
  source_url: string | null;
  published: boolean;
  published_at: string;
  attachments: NewsAttachment[] | null;
};

const createEmptyForm = (isAdmin = false) => ({
  title: "",
  summary: "",
  content: "",
  category: isAdmin ? "비즈니스뉴스" : "공연/문화",
  image_url: "",
  images: [] as string[],
  source_url: "",
  published: true,
  published_at: new Date().toISOString().slice(0, 16),
  attachments: [] as NewsAttachment[],
});

function extractFirstImageUrl(html: string) {
  if (
    typeof window === "undefined" ||
    !html.trim()
  ) {
    return "";
  }

  try {
    const parser = new DOMParser();

    const parsedDocument = parser.parseFromString(
      html,
      "text/html",
    );

    const imageElements = Array.from(
      parsedDocument.querySelectorAll("img"),
    );

    for (const image of imageElements) {
      const possibleSources = [
        image.getAttribute("src"),
        image.getAttribute("data-src"),
        image.getAttribute("data-original"),
        image.getAttribute("data-lazy-src"),
        image.getAttribute("data-url"),
      ];

      for (const possibleSource of possibleSources) {
        const source = String(
          possibleSource ?? "",
        ).trim();

        if (!source) {
          continue;
        }

        if (
          source.startsWith("blob:") ||
          source.startsWith("data:")
        ) {
          continue;
        }

        if (
          source.startsWith("https://") ||
          source.startsWith("http://") ||
          source.startsWith("/")
        ) {
          return source;
        }
      }

      const srcSet = String(
        image.getAttribute("srcset") ??
          image.getAttribute("data-srcset") ??
          "",
      ).trim();

      if (srcSet) {
        const firstSrcSetImage = srcSet
          .split(",")
          .map((entry) =>
            entry.trim().split(/\s+/)[0],
          )
          .find(
            (source) =>
              source.startsWith("https://") ||
              source.startsWith("http://") ||
              source.startsWith("/"),
          );

        if (firstSrcSetImage) {
          return firstSrcSetImage;
        }
      }
    }

    return "";
  } catch (error) {
    console.error(
      "본문 이미지 추출 오류:",
      error,
    );

    return "";
  }
}

function AdminBusinessNewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<NewsItem[]>([]);
  const [form, setForm] = useState(createEmptyForm(false));
  const [userId, setUserId] =
    useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingId, setEditingId] =
    useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] =
    useState(false);
  const [deletingImageUrl, setDeletingImageUrl] =
    useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [deletingFilePath, setDeletingFilePath] =
    useState<string | null>(null);

  const imageInputRef =
    useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadItems() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      const redirectPath =
        window.location.pathname +
        window.location.search;

      sessionStorage.setItem(
        "ktown_login_redirect",
        redirectPath,
      );

      router.push(
        `/login?redirect=${encodeURIComponent(
          redirectPath,
        )}`,
      );

      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(profile?.role ?? "")
      .trim()
      .toLowerCase();

    const adminUser =
      role === "admin" ||
      role === "super_admin";

    setUserId(user.id);
    setIsAdmin(adminUser);

    setForm((current) => {
      const nextCategory =
        adminUser &&
        current.category === "공연/문화"
          ? "비즈니스뉴스"
          : adminUser
            ? current.category
            : "공연/문화";

      return {
        ...current,
        category: nextCategory,
        published: adminUser
          ? current.published
          : true,
      };
    });

    let query = supabase
      .from("business_news")
      .select("*")
      .order("published_at", {
        ascending: false,
      });

    if (!adminUser) {
      query = query
        .eq("category", "공연/문화")
        .eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "News admin load error:",
        error,
      );

      window.alert(error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as NewsItem[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    const editId = Number(
      searchParams.get("edit"),
    );

    if (
      !editId ||
      items.length === 0
    ) {
      return;
    }

    const item = items.find(
      (news) => news.id === editId,
    );

    if (item) {
      startEdit(item);
    }
  }, [items, searchParams]);

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm(isAdmin));
    router.replace("/admin/news");
  }

  function startEdit(item: NewsItem) {
    if (
      !isAdmin &&
      item.category !== "공연/문화"
    ) {
      window.alert(
        "일반 사용자는 공연/문화 글만 수정할 수 있습니다.",
      );

      return;
    }

    setEditingId(item.id);

    setForm({
      title: item.title,
      summary: item.summary || "",
      content: item.content || "",
      category: isAdmin
        ? item.category
        : "공연/문화",
      image_url: item.image_url || "",
      images:
        Array.isArray(item.images) &&
        item.images.length > 0
          ? item.images
          : item.image_url
            ? [item.image_url]
            : [],
      source_url: item.source_url || "",
      published: item.published,
      published_at: new Date(
        item.published_at,
      )
        .toISOString()
        .slice(0, 16),
      attachments: Array.isArray(item.attachments)
        ? item.attachments
        : [],
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function resizeImageFile(file: File) {
    if (file.type === "image/gif") {
      return file;
    }

    const MAX_WIDTH = 1600;
    const MAX_HEIGHT = 1600;
    const QUALITY = 0.82;

    const imageBitmap =
      await createImageBitmap(file);

    const scale = Math.min(
      1,
      MAX_WIDTH / imageBitmap.width,
      MAX_HEIGHT / imageBitmap.height,
    );

    const width = Math.max(
      1,
      Math.round(
        imageBitmap.width * scale,
      ),
    );

    const height = Math.max(
      1,
      Math.round(
        imageBitmap.height * scale,
      ),
    );

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      imageBitmap.close();

      throw new Error(
        "이미지 크기를 조정할 수 없습니다.",
      );
    }

    context.drawImage(
      imageBitmap,
      0,
      0,
      width,
      height,
    );

    imageBitmap.close();

    const outputType =
      file.type === "image/png"
        ? "image/webp"
        : "image/jpeg";

    const extension =
      outputType === "image/webp"
        ? "webp"
        : "jpg";

    const blob =
      await new Promise<Blob>(
        (resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) {
                resolve(result);
              } else {
                reject(
                  new Error(
                    "이미지 압축에 실패했습니다.",
                  ),
                );
              }
            },
            outputType,
            QUALITY,
          );
        },
      );

    const originalBaseName =
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "-",
        ) || "news-image";

    return new File(
      [blob],
      `${originalBaseName}.${extension}`,
      {
        type: outputType,
        lastModified: Date.now(),
      },
    );
  }

  function getStoragePathFromPublicUrl(
    url: string,
  ) {
    const marker =
      "/storage/v1/object/public/business-news/";

    if (!url.includes(marker)) {
      return null;
    }

    return decodeURIComponent(
      url.split(marker)[1] || "",
    );
  }

  function sanitizeFileName(fileName: string) {
    const extension = fileName.includes(".")
      ? `.${fileName.split(".").pop()}`
      : "";

    const baseName = fileName
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9가-힣_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "file";

    return `${baseName}${extension.toLowerCase()}`;
  }

  function formatFileSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 KB";
    }

    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const remainingSlots = 10 - form.attachments.length;

    if (remainingSlots <= 0) {
      window.alert("첨부파일은 최대 10개까지 등록할 수 있습니다.");
      return;
    }

    const files = selectedFiles.slice(0, remainingSlots);

    if (selectedFiles.length > remainingSlots) {
      window.alert(
        `최대 10개까지만 등록됩니다. 선택한 파일 중 ${remainingSlots}개만 업로드합니다.`,
      );
    }

    const oversizedFile = files.find(
      (file) => file.size > 50 * 1024 * 1024,
    );

    if (oversizedFile) {
      window.alert("파일 한 개의 크기는 50MB 이하여야 합니다.");
      return;
    }

    setUploadingFiles(true);
    const uploadedFiles: NewsAttachment[] = [];

    try {
      for (const file of files) {
        const safeName = sanitizeFileName(file.name);
        const filePath =
          `files/${userId ?? "anonymous"}/${Date.now()}-` +
          `${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("business-files")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage
          .from("business-files")
          .getPublicUrl(filePath);

        uploadedFiles.push({
          name: file.name,
          url: data.publicUrl,
          path: filePath,
          type: file.type || "application/octet-stream",
          size: file.size,
        });
      }

      setForm((current) => ({
        ...current,
        attachments: [
          ...current.attachments,
          ...uploadedFiles,
        ].slice(0, 10),
      }));
    } catch (error) {
      console.error("News file upload error:", error);
      window.alert(
        error instanceof Error
          ? `파일 업로드 실패: ${error.message}`
          : "파일을 업로드하지 못했습니다.",
      );
    } finally {
      setUploadingFiles(false);
    }
  }

  async function removeUploadedFile(index: number) {
    const attachment = form.attachments[index];

    if (!attachment || deletingFilePath) {
      return;
    }

    if (!window.confirm(`“${attachment.name}” 파일을 삭제하시겠습니까?`)) {
      return;
    }

    setDeletingFilePath(attachment.path);

    try {
      const { error: storageError } = await supabase.storage
        .from("business-files")
        .remove([attachment.path]);

      if (storageError) {
        throw storageError;
      }

      const nextAttachments = form.attachments.filter(
        (_, fileIndex) => fileIndex !== index,
      );

      setForm((current) => ({
        ...current,
        attachments: nextAttachments,
      }));

      if (editingId) {
        const { error: updateError } = await supabase
          .from("business_news")
          .update({ attachments: nextAttachments })
          .eq("id", editingId);

        if (updateError) {
          throw updateError;
        }

        setItems((currentItems) =>
          currentItems.map((item) =>
            item.id === editingId
              ? { ...item, attachments: nextAttachments }
              : item,
          ),
        );
      }
    } catch (error) {
      console.error("News file delete error:", error);
      window.alert(
        error instanceof Error
          ? `파일 삭제 실패: ${error.message}`
          : "파일을 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingFilePath(null);
    }
  }

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const remainingSlots =
      10 - form.images.length;

    if (remainingSlots <= 0) {
      window.alert(
        "이미지는 최대 10개까지 등록할 수 있습니다.",
      );

      return;
    }

    const files = selectedFiles.slice(
      0,
      remainingSlots,
    );

    if (
      selectedFiles.length >
      remainingSlots
    ) {
      window.alert(
        `최대 10개까지만 등록됩니다. 선택한 이미지 중 ${remainingSlots}개만 업로드합니다.`,
      );
    }

    const invalidFile = files.find(
      (file) =>
        !file.type.startsWith("image/"),
    );

    if (invalidFile) {
      window.alert(
        "이미지 파일만 등록할 수 있습니다.",
      );

      return;
    }

    const oversizedFile = files.find(
      (file) =>
        file.size >
        25 * 1024 * 1024,
    );

    if (oversizedFile) {
      window.alert(
        "원본 이미지 한 장의 크기는 25MB 이하여야 합니다.",
      );

      return;
    }

    setUploadingImages(true);

    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        const resizedFile =
          await resizeImageFile(file);

        const extension =
          resizedFile.name
            .split(".")
            .pop()
            ?.toLowerCase() ||
          "jpg";

        const safeExtension =
          extension.replace(
            /[^a-z0-9]/g,
            "",
          ) || "jpg";

        const filePath =
          `news/${Date.now()}-` +
          `${crypto.randomUUID()}.` +
          safeExtension;

        const { error: uploadError } =
          await supabase.storage
            .from("business-news")
            .upload(
              filePath,
              resizedFile,
              {
                cacheControl: "3600",
                upsert: false,
                contentType:
                  resizedFile.type,
              },
            );

        if (uploadError) {
          throw uploadError;
        }

        const { data } =
          supabase.storage
            .from("business-news")
            .getPublicUrl(filePath);

        uploadedUrls.push(
          data.publicUrl,
        );
      }

      setForm((current) => {
        const nextImages = [
          ...current.images,
          ...uploadedUrls,
        ].slice(0, 10);

        return {
          ...current,
          images: nextImages,
          image_url:
            current.image_url ||
            nextImages[0] ||
            "",
        };
      });
    } catch (error) {
      console.error(
        "News image upload error:",
        error,
      );

      window.alert(
        error instanceof Error
          ? `이미지 업로드 실패: ${error.message}`
          : "이미지를 업로드하지 못했습니다.",
      );
    } finally {
      setUploadingImages(false);
    }
  }

  async function removeUploadedImage(
    index: number,
  ) {
    const imageUrl =
      form.images[index];

    if (
      !imageUrl ||
      deletingImageUrl
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "이 이미지를 삭제하시겠습니까?",
      );

    if (!confirmed) {
      return;
    }

    setDeletingImageUrl(imageUrl);

    try {
      const storagePath =
        getStoragePathFromPublicUrl(
          imageUrl,
        );

      if (storagePath) {
        const { error } =
          await supabase.storage
            .from("business-news")
            .remove([storagePath]);

        if (error) {
          throw error;
        }
      }

      const nextImages =
        form.images.filter(
          (_, imageIndex) =>
            imageIndex !== index,
        );

      const nextRepresentativeImage =
        form.image_url === imageUrl
          ? nextImages[0] || ""
          : form.image_url;

      setForm((current) => ({
        ...current,
        images: nextImages,
        image_url:
          nextRepresentativeImage,
      }));

      if (editingId) {
        const {
          error: updateError,
        } = await supabase
          .from("business_news")
          .update({
            images: nextImages,
            image_url:
              nextRepresentativeImage ||
              null,
          })
          .eq("id", editingId);

        if (updateError) {
          throw updateError;
        }

        setItems(
          (currentItems) =>
            currentItems.map(
              (item) =>
                item.id === editingId
                  ? {
                      ...item,
                      images:
                        nextImages,
                      image_url:
                        nextRepresentativeImage ||
                        null,
                    }
                  : item,
            ),
        );
      }
    } catch (error) {
      console.error(
        "News image delete error:",
        error,
      );

      window.alert(
        error instanceof Error
          ? `이미지 삭제 실패: ${error.message}`
          : "이미지를 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingImageUrl(null);
    }
  }

  function setRepresentativeImage(
    imageUrl: string,
  ) {
    setForm((current) => ({
      ...current,
      image_url: imageUrl,
    }));
  }

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!userId) {
      window.alert(
        "로그인이 필요합니다.",
      );

      const redirectPath =
        window.location.pathname +
        window.location.search;

      sessionStorage.setItem(
        "ktown_login_redirect",
        redirectPath,
      );

      router.push(
        `/login?redirect=${encodeURIComponent(
          redirectPath,
        )}`,
      );

      return;
    }

    if (
      !isAdmin &&
      form.category !== "공연/문화"
    ) {
      window.alert(
        "일반 사용자는 공연/문화 글만 등록할 수 있습니다.",
      );

      return;
    }

    if (!form.title.trim()) {
      window.alert(
        "제목을 입력하세요.",
      );

      return;
    }

    if (!form.content.trim()) {
      window.alert(
        "본문을 입력하세요.",
      );

      return;
    }

    setSaving(true);

    try {
      const manualImageUrl =
        form.image_url.trim();

      const selectedUploadedImage =
        form.images.includes(
          manualImageUrl,
        )
          ? manualImageUrl
          : "";

      const firstUploadedImage =
        form.images[0] || "";

      const firstContentImage =
        extractFirstImageUrl(
          form.content,
        );

      /*
       * 대표 이미지 적용 순서
       *
       * 1. 첨부 이미지 중 사용자가 선택한 대표 이미지
       * 2. 첨부 이미지의 첫 번째 이미지
       * 3. 대표 이미지 URL 입력란
       * 4. 본문 HTML의 첫 번째 이미지
       */
      const representativeImageUrl =
        selectedUploadedImage ||
        firstUploadedImage ||
        manualImageUrl ||
        firstContentImage ||
        null;

      const payload = {
        user_id: userId,
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content,
        category: isAdmin
          ? form.category
          : "공연/문화",
        image_url:
          representativeImageUrl,
        images: form.images,
        source_url:
          form.source_url.trim() ||
          null,
        published: isAdmin
          ? form.published
          : true,
        published_at: new Date(
          form.published_at,
        ).toISOString(),
        attachments: form.attachments,
      };

      let result;

      if (editingId) {
        let updateQuery = supabase
          .from("business_news")
          .update(payload)
          .eq("id", editingId);

        if (!isAdmin) {
          updateQuery =
            updateQuery
              .eq(
                "user_id",
                userId,
              )
              .eq(
                "category",
                "공연/문화",
              );
        }

        result =
          await updateQuery;
      } else {
        result = await supabase
          .from("business_news")
          .insert(payload);
      }

      if (result.error) {
        console.error(
          "News save error:",
          result.error,
        );

        window.alert(
          result.error.message,
        );

        return;
      }

      resetForm();
      await loadItems();
    } catch (error) {
      console.error(
        "News save unexpected error:",
        error,
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "뉴스를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: number) {
    if (
      !window.confirm(
        "이 뉴스와 등록된 이미지를 모두 삭제하시겠습니까?",
      )
    ) {
      return;
    }

    const targetItem =
      items.find(
        (item) =>
          item.id === id,
      );

    const imageUrls =
      Array.from(
        new Set(
          [
            ...(Array.isArray(
              targetItem?.images,
            )
              ? targetItem.images
              : []),
            targetItem?.image_url ||
              "",
          ].filter(Boolean),
        ),
      );

    const storagePaths =
      imageUrls
        .map(
          getStoragePathFromPublicUrl,
        )
        .filter(
          (
            path,
          ): path is string =>
            Boolean(path),
        );

    const attachmentPaths = Array.isArray(targetItem?.attachments)
      ? targetItem.attachments
          .map((attachment) => attachment.path)
          .filter(Boolean)
      : [];

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("business-news")
        .remove(storagePaths);

      if (storageError) {
        window.alert(`이미지 삭제 실패: ${storageError.message}`);
        return;
      }
    }

    if (attachmentPaths.length > 0) {
      const { error: fileStorageError } = await supabase.storage
        .from("business-files")
        .remove(attachmentPaths);

      if (fileStorageError) {
        window.alert(`첨부파일 삭제 실패: ${fileStorageError.message}`);
        return;
      }
    }

    let deleteQuery =
      supabase
        .from("business_news")
        .delete()
        .eq("id", id);

    if (
      !isAdmin &&
      userId
    ) {
      deleteQuery =
        deleteQuery
          .eq("user_id", userId)
          .eq(
            "category",
            "공연/문화",
          );
    }

    const { error } =
      await deleteQuery;

    if (error) {
      window.alert(
        error.message,
      );

      return;
    }

    if (
      editingId === id
    ) {
      resetForm();
    }

    await loadItems();
  }

  const previewRepresentativeImage =
    form.image_url.trim() ||
    form.images[0] ||
    extractFirstImageUrl(
      form.content,
    );

  return (
    <main className="min-h-screen bg-[#F7F7F7] px-3 py-4 text-[#172033]">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center">
          <button
            type="button"
            onClick={() =>
              router.back()
            }
            aria-label="Go back"
            className="
              flex h-10 w-10 shrink-0 items-center justify-center
              rounded-full transition
              active:scale-90 active:bg-gray-100
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="min-w-0 flex-1 px-2 text-center">
            <h1 className="text-lg font-bold">
              {isAdmin
                ? "Business News 관리"
                : "공연/문화 글쓰기"}
            </h1>

            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              {isAdmin
                ? "관리자는 모든 뉴스 카테고리를 등록하고 관리할 수 있습니다."
                : "일반 사용자는 공연/문화 글만 등록할 수 있습니다."}
            </p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <ProfileButton />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-3 text-sm font-semibold">
            {editingId
              ? isAdmin
                ? "뉴스 수정"
                : "공연/문화 수정"
              : isAdmin
                ? "새 뉴스 등록"
                : "공연/문화 등록"}
          </h2>

          <div className="grid gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold">
                제목 *
              </span>

              <input
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title:
                      event.target
                        .value,
                  })
                }
                className="h-11 w-full rounded-xl border border-gray-300 px-3 outline-none focus:border-[#F7A928]"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold">
                카테고리
              </span>

              {isAdmin ? (
                <select
                  value={
                    form.category
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,
                      category:
                        event.target
                          .value,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-gray-300 px-3 outline-none"
                >
                  <option value="비즈니스뉴스">
                    비즈니스뉴스
                  </option>

                  <option value="상공인뉴스">
                    상공인뉴스
                  </option>

                  <option value="공연/문화">
                    공연/문화
                  </option>
                </select>
              ) : (
                <div className="flex h-11 w-full items-center rounded-xl border border-gray-300 bg-gray-100 px-3 text-sm font-semibold text-[#172033]">
                  🎭 공연/문화
                </div>
              )}
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold">
                게시일
              </span>

              <input
                type="datetime-local"
                value={
                  form.published_at
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    published_at:
                      event.target
                        .value,
                  })
                }
                className="h-11 w-full rounded-xl border border-gray-300 px-3 outline-none"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold">
                요약
              </span>

              <textarea
                value={form.summary}
                onChange={(event) =>
                  setForm({
                    ...form,
                    summary:
                      event.target
                        .value,
                  })
                }
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none"
              />
            </label>

            <div>
              <span className="mb-1 block text-xs font-semibold">
                본문 HTML *
              </span>

              <RichTextEditor
                value={form.content}
                onChange={(
                  content,
                ) =>
                  setForm(
                    (current) => ({
                      ...current,
                      content,
                    }),
                  )
                }
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  뉴스 이미지
                </span>

                <span className="text-[10px] text-gray-500">
                  {
                    form.images
                      .length
                  }
                  /10
                </span>
              </div>

              <input
                ref={
                  imageInputRef
                }
                type="file"
                accept="image/*"
                multiple
                onChange={
                  handleImageUpload
                }
                className="hidden"
              />

              <button
                type="button"
                onClick={() =>
                  imageInputRef.current?.click()
                }
                disabled={
                  uploadingImages ||
                  form.images
                    .length >= 10
                }
                className="
                  flex h-11 w-full items-center justify-center gap-2
                  rounded-xl border border-dashed border-[#F7A928]
                  bg-[#FFF9ED] text-xs font-semibold text-[#8B5A13]
                  transition active:scale-[0.98]
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>

                {uploadingImages
                  ? "이미지 업로드 중..."
                  : form.images
                        .length >=
                      10
                    ? "이미지 10개 등록 완료"
                    : "이미지 등록"}
              </button>

              <p className="mt-1.5 text-[10px] leading-4 text-gray-500">
                첨부 이미지가 없고 대표 이미지 URL도 비어 있으면
                본문에 포함된 첫 번째 이미지가 대표 이미지로 자동
                저장됩니다.
              </p>

              {form.images.length >
                0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {form.images.map(
                    (
                      imageUrl,
                      index,
                    ) => {
                      const isRepresentative =
                        form.image_url ===
                          imageUrl ||
                        (!form.image_url &&
                          index ===
                            0);

                      return (
                        <div
                          key={`${imageUrl}-${index}`}
                          className="relative aspect-square overflow-hidden rounded-xl bg-gray-100"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setRepresentativeImage(
                                imageUrl,
                              )
                            }
                            className="block h-full w-full"
                            aria-label={`${index + 1}번 이미지를 대표 이미지로 지정`}
                          >
                            <img
                              src={
                                imageUrl
                              }
                              alt={`뉴스 이미지 ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </button>

                          {isRepresentative && (
                            <span className="absolute bottom-1 left-1 rounded-full bg-[#F7A928] px-1.5 py-0.5 text-[8px] font-semibold text-[#172033]">
                              대표
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              removeUploadedImage(
                                index,
                              )
                            }
                            disabled={
                              deletingImageUrl ===
                              imageUrl
                            }
                            aria-label={`${index + 1}번 이미지 삭제`}
                            className="
                              absolute right-1 top-1 flex h-7 w-7
                              items-center justify-center rounded-full
                              bg-black/70 text-sm leading-none text-white
                              disabled:opacity-50
                            "
                          >
                            {deletingImageUrl ===
                            imageUrl
                              ? "…"
                              : "×"}
                          </button>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  일반 첨부파일
                </span>

                <span className="text-[10px] text-gray-500">
                  {form.attachments.length}/10
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.hwp,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  uploadingFiles ||
                  form.attachments.length >= 10
                }
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#1B365D] bg-[#F4F7FB] text-xs font-semibold text-[#1B365D] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">📎</span>
                {uploadingFiles
                  ? "파일 업로드 중..."
                  : form.attachments.length >= 10
                    ? "첨부파일 10개 등록 완료"
                    : "PDF · Word · Excel · 일반 파일 등록"}
              </button>

              <p className="mt-1.5 text-[10px] leading-4 text-gray-500">
                파일당 최대 50MB입니다. PDF와 이미지는 브라우저에서 바로
                볼 수 있고, 나머지 파일은 다운로드할 수 있습니다.
              </p>

              {form.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {form.attachments.map((attachment, index) => (
                    <div
                      key={`${attachment.path}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                    >
                      <span className="text-xl" aria-hidden="true">
                        📄
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {attachment.name}
                        </p>
                        <p className="mt-0.5 text-[9px] text-gray-500">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>

                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-semibold text-[#1B365D] shadow-sm"
                      >
                        보기
                      </a>

                      <button
                        type="button"
                        onClick={() => removeUploadedFile(index)}
                        disabled={deletingFilePath === attachment.path}
                        className="rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-semibold text-red-600 disabled:opacity-50"
                      >
                        {deletingFilePath === attachment.path ? "…" : "삭제"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label>
              <span className="mb-1 block text-xs font-semibold">
                대표 이미지 URL
              </span>

              <input
                value={
                  form.image_url
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    image_url:
                      event.target
                        .value,
                  })
                }
                placeholder="비워두면 첨부 이미지 또는 본문 이미지 자동 사용"
                className="h-11 w-full rounded-xl border border-gray-300 px-3 outline-none"
              />
            </label>

            {previewRepresentativeImage && (
              <div>
                <span className="mb-1 block text-xs font-semibold">
                  대표 이미지 미리보기
                </span>

                <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-gray-100">
                  <img
                    src={
                      previewRepresentativeImage
                    }
                    alt="대표 이미지 미리보기"
                    className="h-full w-full object-cover"
                    onError={(
                      event,
                    ) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                  />
                </div>

                {!form.image_url.trim() &&
                  form.images
                    .length ===
                    0 &&
                  extractFirstImageUrl(
                    form.content,
                  ) && (
                    <p className="mt-1 text-[10px] font-medium text-[#8B5A13]">
                      본문의 첫 번째 이미지를 대표 이미지로 사용합니다.
                    </p>
                  )}
              </div>
            )}

            <label>
              <span className="mb-1 block text-xs font-semibold">
                원문 링크
              </span>

              <input
                value={
                  form.source_url
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    source_url:
                      event.target
                        .value,
                  })
                }
                placeholder="https://..."
                className="h-11 w-full rounded-xl border border-gray-300 px-3 outline-none"
              />
            </label>

            {isAdmin && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    form.published
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,
                      published:
                        event.target
                          .checked,
                    })
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm font-medium">
                  공개
                </span>
              </label>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={
                saving ||
                uploadingImages ||
                uploadingFiles
              }
              className="rounded-xl bg-[#172033] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? "저장 중..."
                : uploadingImages || uploadingFiles
                  ? "업로드 중..."
                  : editingId
                    ? "수정 저장"
                    : isAdmin
                      ? "뉴스 등록"
                      : "공연/문화 등록"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                className="rounded-xl border px-5 py-2.5 text-sm font-medium"
              >
                취소
              </button>
            )}
          </div>
        </form>

        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">
              {isAdmin
                ? "등록된 뉴스"
                : "내가 등록한 공연/문화"}
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              불러오는 중...
            </div>
          ) : (
            <div>
              {items.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      item.id
                    }
                    className="border-t border-gray-100 px-4 py-3 first:border-t-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug">
                            {
                              item.title
                            }
                          </h3>

                          {index ===
                            0 &&
                            item.published && (
                              <span className="shrink-0 rounded-full bg-[#F7A928] px-2 py-0.5 text-[8px] font-semibold">
                                LATEST
                              </span>
                            )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500">
                          <span>
                            {
                              item.category
                            }
                          </span>

                          <span>•</span>

                          <span>
                            {new Date(
                              item.published_at,
                            ).toLocaleString()}
                          </span>

                          <span>•</span>

                          <span>
                            {item.published
                              ? "공개"
                              : "비공개"}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              item,
                            )
                          }
                          className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-medium text-blue-700"
                        >
                          수정
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteItem(
                              item.id,
                            )
                          }
                          className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-medium text-red-600"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              )}

              {items.length ===
                0 && (
                <div className="px-4 py-10 text-center text-sm text-gray-500">
                  등록된 뉴스가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AdminBusinessNewsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          불러오는 중...
        </main>
      }
    >
      <AdminBusinessNewsContent />
    </Suspense>
  );
}