"use client";

import {
  DragEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../../../../../../lib/supabase";
import {
  MAGAZINE_LAYOUT_LIST,
  getMagazineLayout,
  type MagazineSlot,
} from "../../../../../../components/magazineLayouts";
import type {
  AdPageLayoutType,
  FlipbookAdOrientation,
  FlipbookAdSize,
} from "../../../../../../components/flipbookTypes";
import CustomLayoutEditor from "./CustomLayoutEditor";
import type {
  MagazineAdLibraryRow,
  MagazineIssueEditorRow,
  MagazinePageEditorRow,
  MagazineSlotEditorRow,
} from "./page";

type Props = {
  issue: MagazineIssueEditorRow;
  initialPages: MagazinePageEditorRow[];
  initialSlots: MagazineSlotEditorRow[];
  initialAds: MagazineAdLibraryRow[];
};

type DraggedAd = {
  adId: string;
};

const AD_DRAG_TYPE =
  "application/x-ktown-ad";

const sizeLabel: Record<
  FlipbookAdSize,
  string
> = {
  1: "전체면",
  2: "반면",
  3: "1/4면",
  4: "1/6면",
  5: "1/12면",
};

function orientationLabel(
  orientation:
    | FlipbookAdOrientation
    | null,
) {
  switch (orientation) {
    case "vertical":
      return "세로";
    case "square":
      return "정사각";
    default:
      return "가로";
  }
}

function paymentLabel(
  status:
    | MagazineAdLibraryRow["payment_status"],
) {
  switch (status) {
    case "paid":
      return "결제 완료";
    case "pending":
      return "결제 대기";
    case "refunded":
      return "환불";
    case "waived":
      return "무료";
    default:
      return "미결제";
  }
}

function getPaymentClasses(
  status:
    | MagazineAdLibraryRow["payment_status"],
) {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "waived":
      return "bg-sky-100 text-sky-800";
    case "refunded":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-red-100 text-red-800";
  }
}

function isExpired(
  endDate: string | null,
) {
  if (!endDate) return false;

  const end = new Date(
    `${endDate}T23:59:59`,
  );

  return (
    !Number.isNaN(end.getTime()) &&
    end.getTime() < Date.now()
  );
}

function createClientId() {
  return `temp-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getNextPageNumber(
  pages: MagazinePageEditorRow[],
) {
  if (pages.length === 0) {
    return 1;
  }

  return (
    Math.max(
      ...pages.map(
        (page) => page.page_number,
      ),
    ) + 1
  );
}

export default function MagazineEditor({
  issue,
  initialPages,
  initialSlots,
  initialAds,
}: Props) {
  const [pages, setPages] = useState(
    initialPages,
  );

  const [slots, setSlots] = useState(
    initialSlots,
  );

  const [selectedLayout, setSelectedLayout] =
    useState<AdPageLayoutType>("full");

  const [selectedPageId, setSelectedPageId] =
    useState<number | null>(
      initialPages[0]?.id || null,
    );

  /*
   * 서버에서 Issue 데이터를 다시 받아올 때 전체 페이지와 슬롯을
   * 편집기 상태에 다시 동기화합니다.
   */
  useEffect(() => {
    const sortedPages = [...initialPages].sort(
      (a, b) =>
        a.page_number - b.page_number,
    );

    setPages(sortedPages);
    setSlots(initialSlots);

    setSelectedPageId((currentId) => {
      const currentPageExists =
        sortedPages.some(
          (page) =>
            page.id === currentId,
        );

      if (currentPageExists) {
        return currentId;
      }

      return sortedPages[0]?.id || null;
    });
  }, [initialPages, initialSlots]);

  /*
   * 페이지 탭을 바꾸면 레이아웃 선택창도 해당 페이지의
   * 실제 레이아웃 값으로 맞춥니다.
   */
  useEffect(() => {
    const currentPage = pages.find(
      (page) =>
        page.id === selectedPageId,
    );

    if (currentPage) {
      setSelectedLayout(
        currentPage.layout_type,
      );
    }
  }, [pages, selectedPageId]);

  const [searchText, setSearchText] =
    useState("");

  const [sizeFilter, setSizeFilter] =
    useState<
      FlipbookAdSize | "all"
    >("all");

  const [message, setMessage] =
    useState<string | null>(null);

  const [isAddingPage, setIsAddingPage] =
    useState(false);

  const [isChangingLayout, setIsChangingLayout] =
    useState(false);

  const [busySlotId, setBusySlotId] =
    useState<number | null>(null);

  const [busyPageId, setBusyPageId] =
    useState<number | null>(null);

  const [isCheckingSave, setIsCheckingSave] =
    useState(false);

  const [isPublishing, setIsPublishing] =
    useState(false);

  const [lastSavedAt, setLastSavedAt] =
    useState<string | null>(null);

  /*
   * 마우스 드래그가 어려운 모바일/브라우저를 위한 보조 기능입니다.
   * 광고 카드를 한 번 클릭한 뒤 원하는 슬롯을 클릭해도 배치됩니다.
   */
  const [selectedAdId, setSelectedAdId] =
    useState<string | null>(null);

  const adMap = useMemo(
    () =>
      new Map(
        initialAds.map((ad) => [
          ad.id,
          ad,
        ]),
      ),
    [initialAds],
  );

  const usedAdIds = useMemo(
    () =>
      new Set(
        slots
          .map((slot) => slot.ad_id)
          .filter(
            (id): id is string =>
              typeof id === "string" &&
              id.length > 0,
          ),
      ),
    [slots],
  );

  const filteredAds = useMemo(() => {
    const query = searchText
      .trim()
      .toLowerCase();

    return initialAds.filter((ad) => {
      if (
        sizeFilter !== "all" &&
        ad.ad_size !== sizeFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        ad.business_name,
        ad.ad_title || "",
      ].some((value) =>
        value
          .toLowerCase()
          .includes(query),
      );
    });
  }, [
    initialAds,
    searchText,
    sizeFilter,
  ]);

  const selectedPage =
    pages.find(
      (page) =>
        page.id === selectedPageId,
    ) || null;

  const selectedPageSlots = useMemo(
    () =>
      slots
        .filter(
          (slot) =>
            slot.page_id ===
            selectedPageId,
        )
        .sort(
          (a, b) =>
            a.sort_order -
            b.sort_order,
        ),
    [selectedPageId, slots],
  );

  const addPage = async () => {
    setIsAddingPage(true);
    setMessage(null);

    const nextPageNumber =
      getNextPageNumber(pages);

    /*
     * 자유 레이아웃은 고정 슬롯 목록이 없으므로
     * 페이지 전체를 하나의 leaf 슬롯으로 시작합니다.
     */
    if (selectedLayout === "custom") {
      const rootId = `leaf-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      const layoutJson = {
        version: 1,
        root: {
          id: rootId,
          type: "leaf",
        },
      };

      try {
        const {
          data: newPage,
          error: pageError,
        } = await supabase
          .from("magazine_pages")
          .insert({
            issue_id: issue.id,
            page_number:
              nextPageNumber,
            page_type:
              "advertisement",
            layout_type: "custom",
            layout_json: layoutJson,
            page_title: `Page ${nextPageNumber}`,
            background_color:
              "#ffffff",
          })
          .select(`
            id,
            issue_id,
            page_number,
            page_type,
            layout_type,
            layout_json,
            page_title,
            background_color,
            page_image_url
          `)
          .single();

        if (pageError || !newPage) {
          throw (
            pageError ||
            new Error(
              "자유 페이지 생성에 실패했습니다.",
            )
          );
        }

        const {
          data: createdSlot,
          error: slotError,
        } = await supabase
          .from("magazine_page_slots")
          .insert({
            page_id: newPage.id,
            slot_key: rootId,
            ad_id: null,
            expected_ad_size: 1,
            expected_orientation: null,
            grid_column_start: 1,
            grid_row_start: 1,
            grid_column_span: 6,
            grid_row_span: 6,
            sort_order: 0,
          })
          .select(`
            id,
            page_id,
            slot_key,
            ad_id,
            expected_ad_size,
            expected_orientation,
            grid_column_start,
            grid_row_start,
            grid_column_span,
            grid_row_span,
            sort_order
          `)
          .single();

        if (slotError || !createdSlot) {
          /*
           * 슬롯 생성 실패 시 빈 페이지만 남지 않도록
           * 방금 만든 페이지를 제거합니다.
           */
          await supabase
            .from("magazine_pages")
            .delete()
            .eq("id", newPage.id);

          throw (
            slotError ||
            new Error(
              "자유 페이지 슬롯 생성에 실패했습니다.",
            )
          );
        }

        setPages((current) => [
          ...current,
          newPage as MagazinePageEditorRow,
        ]);

        setSlots((current) => [
          ...current,
          createdSlot as MagazineSlotEditorRow,
        ]);

        setSelectedPageId(
          Number(newPage.id),
        );
        setSelectedLayout("custom");
        setSelectedAdId(null);

        setMessage(
          `Page ${nextPageNumber} 자유 페이지를 만들었습니다. 원하는 칸을 나누거나 광고를 배치하세요.`,
        );
      } catch (error) {
        const text =
          error instanceof Error
            ? error.message
            : "자유 페이지를 만들지 못했습니다.";

        setMessage(`오류: ${text}`);
      } finally {
        setIsAddingPage(false);
      }

      return;
    }

    const layout = getMagazineLayout(
      selectedLayout,
    );

    if (
      !layout ||
      layout.slots.length === 0
    ) {
      setMessage(
        "사용할 수 있는 레이아웃을 선택하세요.",
      );
      setIsAddingPage(false);
      return;
    }

    try {
      const {
        data: newPage,
        error: pageError,
      } = await supabase
        .from("magazine_pages")
        .insert({
          issue_id: issue.id,
          page_number:
            nextPageNumber,
          page_type:
            "advertisement",
          layout_type:
            selectedLayout,
          layout_json: null,
          page_title: `Page ${nextPageNumber}`,
          background_color:
            "#ffffff",
        })
        .select(`
          id,
          issue_id,
          page_number,
          page_type,
          layout_type,
          layout_json,
          page_title,
          background_color,
          page_image_url
        `)
        .single();

      if (pageError || !newPage) {
        throw (
          pageError ||
          new Error(
            "페이지 생성에 실패했습니다.",
          )
        );
      }

      const slotRows =
        layout.slots.map(
          (
            slot: MagazineSlot,
            index,
          ) => ({
            page_id: newPage.id,
            slot_key: slot.key,
            ad_id: null,
            expected_ad_size:
              slot.adSize,
            expected_orientation:
              slot.orientation,
            grid_column_start:
              slot.gridColumnStart,
            grid_row_start:
              slot.gridRowStart,
            grid_column_span:
              slot.gridColumnSpan,
            grid_row_span:
              slot.gridRowSpan,
            sort_order: index,
          }),
        );

      const {
        data: createdSlots,
        error: slotError,
      } = await supabase
        .from(
          "magazine_page_slots",
        )
        .insert(slotRows)
        .select(`
          id,
          page_id,
          slot_key,
          ad_id,
          expected_ad_size,
          expected_orientation,
          grid_column_start,
          grid_row_start,
          grid_column_span,
          grid_row_span,
          sort_order
        `);

      if (slotError) {
        /*
         * 슬롯 생성 실패 시 빈 페이지만 남지 않도록
         * 방금 만든 페이지를 제거합니다.
         */
        await supabase
          .from("magazine_pages")
          .delete()
          .eq("id", newPage.id);

        throw slotError;
      }

      setPages((current) => [
        ...current,
        newPage as MagazinePageEditorRow,
      ]);

      setSlots((current) => [
        ...current,
        ...((createdSlots ||
          []) as MagazineSlotEditorRow[]),
      ]);

      setSelectedPageId(
        Number(newPage.id),
      );
      setSelectedAdId(null);

      setMessage(
        `Page ${nextPageNumber}을 만들었습니다.`,
      );
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "페이지를 만들지 못했습니다.";

      setMessage(`오류: ${text}`);
    } finally {
      setIsAddingPage(false);
    }
  };

  const changeSelectedPageLayout = async (
    nextLayoutType: AdPageLayoutType,
  ) => {
    setSelectedLayout(nextLayoutType);

    if (!selectedPage) {
      return;
    }

    if (selectedPage.layout_type === nextLayoutType) {
      return;
    }

    const nextLayout = getMagazineLayout(nextLayoutType);

    if (!nextLayout) {
      setMessage("사용할 수 있는 레이아웃을 선택하세요.");
      return;
    }

    /*
     * 자유 레이아웃은 미리 정해진 슬롯이 없습니다.
     * 페이지 전체를 하나의 leaf로 시작한 뒤 사용자가 계속 분할합니다.
     */
    if (nextLayoutType === "custom") {
      const currentPageSlots = slots.filter(
        (slot) => slot.page_id === selectedPage.id,
      );

      const hasPlacedAds = currentPageSlots.some(
        (slot) => !!slot.ad_id,
      );

      if (hasPlacedAds) {
        const proceed = window.confirm(
          `현재 Page ${selectedPage.page_number}에 배치된 광고가 있습니다.\n\n자유 레이아웃으로 변경하면 현재 광고 배치가 제거됩니다. 계속할까요?`,
        );

        if (!proceed) {
          setSelectedLayout(selectedPage.layout_type);
          return;
        }
      }

      setIsChangingLayout(true);
      setMessage(null);

      const rootId = `leaf-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      const layoutJson = {
        version: 1,
        root: {
          id: rootId,
          type: "leaf",
        },
      };

      try {
        const { error: deleteSlotError } = await supabase
          .from("magazine_page_slots")
          .delete()
          .eq("page_id", selectedPage.id);

        if (deleteSlotError) {
          throw deleteSlotError;
        }

        const { data: updatedPage, error: pageUpdateError } = await supabase
          .from("magazine_pages")
          .update({
            layout_type: "custom",
            layout_json: layoutJson,
          })
          .eq("id", selectedPage.id)
          .select(`
            id,
            issue_id,
            page_number,
            page_type,
            layout_type,
            layout_json,
            page_title,
            background_color,
            page_image_url
          `)
          .single();

        if (pageUpdateError || !updatedPage) {
          throw (
            pageUpdateError ||
            new Error("자유 레이아웃을 시작하지 못했습니다.")
          );
        }

        const { data: createdSlot, error: slotError } = await supabase
          .from("magazine_page_slots")
          .insert({
            page_id: selectedPage.id,
            slot_key: rootId,
            ad_id: null,
            expected_ad_size: 1,
            expected_orientation: null,
            grid_column_start: 1,
            grid_row_start: 1,
            grid_column_span: 6,
            grid_row_span: 6,
            sort_order: 0,
          })
          .select(`
            id,
            page_id,
            slot_key,
            ad_id,
            expected_ad_size,
            expected_orientation,
            grid_column_start,
            grid_row_start,
            grid_column_span,
            grid_row_span,
            sort_order
          `)
          .single();

        if (slotError || !createdSlot) {
          throw (
            slotError ||
            new Error("자유 레이아웃 슬롯을 만들지 못했습니다.")
          );
        }

        setPages((current) =>
          current.map((page) =>
            page.id === selectedPage.id
              ? (updatedPage as MagazinePageEditorRow)
              : page,
          ),
        );

        setSlots((current) => [
          ...current.filter(
            (slot) => slot.page_id !== selectedPage.id,
          ),
          createdSlot as MagazineSlotEditorRow,
        ]);

        setMessage(
          `Page ${selectedPage.page_number}을 자유 레이아웃으로 변경했습니다. 페이지 칸을 클릭해 나누세요.`,
        );
      } catch (error) {
        const text =
          error instanceof Error
            ? error.message
            : "자유 레이아웃을 시작하지 못했습니다.";

        setMessage(`오류: ${text}`);
        setSelectedLayout(selectedPage.layout_type);
      } finally {
        setIsChangingLayout(false);
      }

      return;
    }

    if (nextLayout.slots.length === 0) {
      setMessage("사용할 수 있는 레이아웃을 선택하세요.");
      return;
    }

    const currentPageSlots = slots.filter(
      (slot) => slot.page_id === selectedPage.id,
    );

    const hasPlacedAds = currentPageSlots.some(
      (slot) => !!slot.ad_id,
    );

    if (hasPlacedAds) {
      const proceed = window.confirm(
        `현재 Page ${selectedPage.page_number}에 배치된 광고가 있습니다.\n\n레이아웃을 변경하면 이 페이지의 광고 배치가 모두 제거됩니다. 계속할까요?`,
      );

      if (!proceed) {
        setSelectedLayout(selectedPage.layout_type);
        return;
      }
    }

    setIsChangingLayout(true);
    setMessage(null);

    try {
      /*
       * 기존 슬롯을 먼저 삭제하고 새 레이아웃 슬롯을 생성합니다.
       * magazine_page_slots는 page_id + slot_key가 유일하므로
       * 이전 슬롯을 남겨 둔 채 새 슬롯을 넣을 수 없습니다.
       */
      const { error: deleteSlotError } = await supabase
        .from("magazine_page_slots")
        .delete()
        .eq("page_id", selectedPage.id);

      if (deleteSlotError) {
        throw deleteSlotError;
      }

      const { data: updatedPage, error: pageUpdateError } = await supabase
        .from("magazine_pages")
        .update({
          layout_type: nextLayoutType,
          layout_json: null,
        })
        .eq("id", selectedPage.id)
        .select(`
          id,
          issue_id,
          page_number,
          page_type,
          layout_type,
          page_title,
          background_color,
          page_image_url
        `)
        .single();

      if (pageUpdateError || !updatedPage) {
        throw (
          pageUpdateError ||
          new Error("페이지 레이아웃을 변경하지 못했습니다.")
        );
      }

      const nextSlotRows = nextLayout.slots.map(
        (slot: MagazineSlot, index) => ({
          page_id: selectedPage.id,
          slot_key: slot.key,
          ad_id: null,
          expected_ad_size: slot.adSize,
          expected_orientation: slot.orientation,
          grid_column_start: slot.gridColumnStart,
          grid_row_start: slot.gridRowStart,
          grid_column_span: slot.gridColumnSpan,
          grid_row_span: slot.gridRowSpan,
          sort_order: index,
        }),
      );

      const { data: createdSlots, error: createSlotError } = await supabase
        .from("magazine_page_slots")
        .insert(nextSlotRows)
        .select(`
          id,
          page_id,
          slot_key,
          ad_id,
          expected_ad_size,
          expected_orientation,
          grid_column_start,
          grid_row_start,
          grid_column_span,
          grid_row_span,
          sort_order
        `);

      if (createSlotError) {
        throw createSlotError;
      }

      setPages((current) =>
        current.map((page) =>
          page.id === selectedPage.id
            ? (updatedPage as MagazinePageEditorRow)
            : page,
        ),
      );

      setSlots((current) => [
        ...current.filter(
          (slot) => slot.page_id !== selectedPage.id,
        ),
        ...((createdSlots || []) as MagazineSlotEditorRow[]),
      ]);

      setMessage(
        `Page ${selectedPage.page_number} 레이아웃을 "${nextLayout.name}"으로 변경했습니다.`,
      );
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "레이아웃을 변경하지 못했습니다.";

      setMessage(`오류: ${text}`);
      setSelectedLayout(selectedPage.layout_type);
    } finally {
      setIsChangingLayout(false);
    }
  };

  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    ad: MagazineAdLibraryRow,
  ) => {
    const payload: DraggedAd = {
      adId: ad.id,
    };

    event.dataTransfer.setData(
      AD_DRAG_TYPE,
      JSON.stringify(payload),
    );

    event.dataTransfer.setData(
      "text/plain",
      ad.id,
    );

    event.dataTransfer.effectAllowed =
      "copyMove";
  };

  const readDraggedAdId = (
    event: DragEvent<HTMLElement>,
  ) => {
    const customValue =
      event.dataTransfer.getData(
        AD_DRAG_TYPE,
      );

    if (customValue) {
      try {
        const parsed = JSON.parse(
          customValue,
        ) as DraggedAd;

        return parsed.adId || null;
      } catch {
        return null;
      }
    }

    return (
      event.dataTransfer.getData(
        "text/plain",
      ) || null
    );
  };

  const placeAdInSlot = async (
    slot: MagazineSlotEditorRow,
    adId: string,
  ) => {
    const ad = adMap.get(adId);

    if (!ad) {
      setMessage(
        "선택한 광고를 찾지 못했습니다.",
      );
      return;
    }

    /*
     * 기존 광고의 orientation 기본값이 실제 이미지 방향과 다를 수 있으므로
     * 배치 가능 여부는 광고 상품 크기(ad_size)로만 검사합니다.
     */
    const compatible =
      ad.ad_size === slot.expected_ad_size;

    if (!compatible) {
      setMessage(
        `"${ad.business_name}" 광고는 ${
          sizeLabel[ad.ad_size]
        } 광고입니다. 선택한 칸에는 ${
          sizeLabel[slot.expected_ad_size]
        } 광고만 배치할 수 있습니다.`,
      );
      return;
    }

    if (
      usedAdIds.has(adId) &&
      slot.ad_id !== adId
    ) {
      const proceed =
        window.confirm(
          `"${ad.business_name}" 광고는 이미 다른 페이지에 사용 중입니다.\n\n중복 배치할까요?`,
        );

      if (!proceed) {
        return;
      }
    }

    if (isExpired(ad.end_date)) {
      const proceed =
        window.confirm(
          `"${ad.business_name}" 광고 계약 기간이 종료되었습니다.\n\n그래도 배치할까요?`,
        );

      if (!proceed) {
        return;
      }
    }

    if (
      ad.payment_status ===
        "unpaid" ||
      ad.payment_status ===
        "pending"
    ) {
      const proceed =
        window.confirm(
          `"${ad.business_name}" 광고는 ${paymentLabel(
            ad.payment_status,
          )} 상태입니다.\n\n그래도 배치할까요?`,
        );

      if (!proceed) {
        return;
      }
    }

    setBusySlotId(slot.id);
    setMessage(null);

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "magazine_page_slots",
        )
        .update({
          ad_id: adId,
        })
        .eq("id", slot.id)
        .select(`
          id,
          page_id,
          slot_key,
          ad_id,
          expected_ad_size,
          expected_orientation,
          grid_column_start,
          grid_row_start,
          grid_column_span,
          grid_row_span,
          sort_order
        `)
        .single();

      if (error || !data) {
        throw (
          error ||
          new Error(
            "광고 배치에 실패했습니다.",
          )
        );
      }

      setSlots((current) =>
        current.map((item) =>
          item.id === slot.id
            ? (data as MagazineSlotEditorRow)
            : item,
        ),
      );

      setSelectedAdId(null);

      setMessage(
        `"${ad.business_name}" 광고를 배치했습니다.`,
      );
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "광고를 배치하지 못했습니다.";

      setMessage(`오류: ${text}`);
    } finally {
      setBusySlotId(null);
    }
  };

  const handleDrop = async (
    event: DragEvent<HTMLElement>,
    slot: MagazineSlotEditorRow,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const adId =
      readDraggedAdId(event);

    if (!adId) {
      setMessage(
        "끌어온 광고 정보를 읽지 못했습니다.",
      );
      return;
    }

    await placeAdInSlot(
      slot,
      adId,
    );
  };

  const clearSlot = async (
    slot: MagazineSlotEditorRow,
  ) => {
    if (!slot.ad_id) {
      return;
    }

    setBusySlotId(slot.id);
    setMessage(null);

    try {
      const { error } =
        await supabase
          .from(
            "magazine_page_slots",
          )
          .update({
            ad_id: null,
          })
          .eq("id", slot.id);

      if (error) {
        throw error;
      }

      setSlots((current) =>
        current.map((item) =>
          item.id === slot.id
            ? {
                ...item,
                ad_id: null,
              }
            : item,
        ),
      );

      setMessage(
        "슬롯에서 광고를 제거했습니다.",
      );
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "광고를 제거하지 못했습니다.";

      setMessage(`오류: ${text}`);
    } finally {
      setBusySlotId(null);
    }
  };

  const deletePage = async (
    page: MagazinePageEditorRow,
  ) => {
    const confirmed =
      window.confirm(
        `Page ${page.page_number}을 삭제할까요?\n\n이 페이지의 광고 배치 정보도 삭제됩니다.`,
      );

    if (!confirmed) {
      return;
    }

    setBusyPageId(page.id);
    setMessage(null);

    try {
      const { error } =
        await supabase
          .from("magazine_pages")
          .delete()
          .eq("id", page.id);

      if (error) {
        throw error;
      }

      const remainingPages =
        pages.filter(
          (item) =>
            item.id !== page.id,
        );

      setPages(remainingPages);

      setSlots((current) =>
        current.filter(
          (slot) =>
            slot.page_id !==
            page.id,
        ),
      );

      setSelectedPageId(
        remainingPages[0]?.id ||
          null,
      );

      setMessage(
        `Page ${page.page_number}을 삭제했습니다.`,
      );
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "페이지를 삭제하지 못했습니다.";

      setMessage(`오류: ${text}`);
    } finally {
      setBusyPageId(null);
    }
  };

  const formatSavedTime = (value: string | null) => {
    if (!value) return "자동 저장";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "저장됨";
    }

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const verifySavedData = async () => {
    setIsCheckingSave(true);
    setMessage(null);

    try {
      const { error: issueError } = await supabase
        .from("magazine_issues")
        .select("id")
        .eq("id", issue.id)
        .single();

      if (issueError) throw issueError;

      if (selectedPage) {
        const { error: pageError } = await supabase
          .from("magazine_pages")
          .select("id")
          .eq("id", selectedPage.id)
          .single();

        if (pageError) throw pageError;
      }

      const savedAt = new Date().toISOString();

      setLastSavedAt(savedAt);
      setMessage(
        selectedPage
          ? `Page ${selectedPage.page_number}의 저장 상태를 확인했습니다.`
          : "잡지 저장 상태를 확인했습니다.",
      );
    } catch (error) {
      const errorText =
        error instanceof Error
          ? error.message
          : "저장 상태를 확인하지 못했습니다.";

      setMessage(`저장 확인 오류: ${errorText}`);
    } finally {
      setIsCheckingSave(false);
    }
  };

  const openPreview = () => {
    window.open(
      "/community/ads",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const showPdfNotice = () => {
    setMessage(
      "PDF 생성 기능은 아직 연결되지 않았습니다. 플립북 발행 연결 후 PDF 생성 기능을 추가해야 합니다.",
    );
  };

  const publishMagazine = async () => {
    const confirmed = window.confirm(
      `"${issue.title}${
        issue.issue_number
          ? ` · ${issue.issue_number}`
          : ""
      }" 잡지를 공개 발행할까요?`,
    );

    if (!confirmed) return;

    setIsPublishing(true);
    setMessage(null);

    try {
      const publishedAt = new Date().toISOString();

      const { error } = await supabase
        .from("magazine_issues")
        .update({
          status: "published",
          is_public: true,
          published_at: publishedAt,
        })
        .eq("id", issue.id);

      if (error) throw error;

      setLastSavedAt(publishedAt);
      setMessage(
        "잡지를 발행했습니다. 공개 플립북 페이지에서 확인하세요.",
      );
    } catch (error) {
      const errorText =
        error instanceof Error
          ? error.message
          : "잡지를 발행하지 못했습니다.";

      setMessage(`발행 오류: ${errorText}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F3EC]">
      {/* 휴대폰에서도 PC 편집 화면의 너비와 구성을 그대로 유지합니다. */}
      <div className="sticky top-0 z-[70] border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-black text-amber-900 xl:hidden">
        PC 편집 화면입니다. 화면을 좌우로 밀어 편집하세요. 광고는 먼저 선택한 뒤 원하는 빈칸을 누르면 배치됩니다.
      </div>

      <div className="w-full overflow-x-auto overscroll-x-contain">
        <div className="mx-auto grid min-w-[1180px] max-w-[1600px] grid-cols-[340px_minmax(0,1fr)] gap-4 px-4 py-5">
          {/* 광고 라이브러리 */}
      <aside className="sticky top-[82px] h-[calc(100vh-102px)] min-w-0 rounded-[28px] bg-white p-4 shadow-lg">
        <div className="flex h-full min-h-0 flex-col">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#C4483A]">
                  Ad Library
                </p>

                <h2 className="mt-1 text-xl font-black">
                  광고 라이브러리
                </h2>
              </div>

              <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-black text-white">
                {filteredAds.length}
              </span>
            </div>

            <input
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value,
                )
              }
              placeholder="업체명 또는 광고 검색"
              className="mt-4 w-full rounded-2xl border border-black/10 bg-[#F7F4EF] px-4 py-3 text-sm font-bold outline-none focus:border-[#C4483A]"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  "all",
                  1,
                  2,
                  3,
                  4,
                  5,
                ] as const
              ).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() =>
                    setSizeFilter(
                      value,
                    )
                  }
                  className={
                    sizeFilter === value
                      ? "rounded-full bg-[#172033] px-3 py-2 text-[11px] font-black text-white"
                      : "rounded-full bg-[#EEE8DF] px-3 py-2 text-[11px] font-black text-[#5F574D]"
                  }
                >
                  {value === "all"
                    ? "전체"
                    : sizeLabel[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {filteredAds.map((ad) => {
              const used =
                usedAdIds.has(
                  ad.id,
                );

              const expired =
                isExpired(
                  ad.end_date,
                );

              return (
                <article
                  key={ad.id}
                  draggable={true}
                  onDragStart={(event) => {
                    setSelectedAdId(ad.id);
                    handleDragStart(event, ad);
                  }}
                  onDragEnd={() => {
                    /*
                     * 드래그가 취소되어도 클릭 배치용 선택 상태는 유지합니다.
                     */
                  }}
                  onClick={() => {
                    setSelectedAdId((current) => {
                      const nextId =
                        current === ad.id
                          ? null
                          : ad.id;

                      setMessage(
                        nextId
                          ? `"${ad.business_name}" 광고를 선택했습니다. 오른쪽의 맞는 크기 슬롯을 클릭하세요.`
                          : null,
                      );

                      return nextId;
                    });
                  }}
                  className={`cursor-grab overflow-hidden rounded-2xl border bg-white shadow-sm active:cursor-grabbing ${
                    selectedAdId === ad.id
                      ? "border-[#C4483A] ring-4 ring-[#C4483A]/20"
                      : "border-black/10"
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-[#EEE8DF]">
                    <img
                      src={
                        ad.image_url
                      }
                      alt={`${ad.business_name} 광고`}
                      draggable={false}
                      className="pointer-events-none h-full w-full select-none object-contain"
                    />

                    {used && (
                      <span className="absolute left-2 top-2 rounded-full bg-[#172033] px-2 py-1 text-[9px] font-black text-white">
                        사용 중
                      </span>
                    )}

                    {expired && (
                      <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[9px] font-black text-white">
                        기간 종료
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="truncate text-sm font-black">
                      {
                        ad.business_name
                      }
                    </p>

                    {ad.ad_title && (
                      <p className="mt-1 truncate text-xs font-bold text-[#756C61]">
                        {ad.ad_title}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full bg-[#EEE8DF] px-2 py-1 text-[9px] font-black">
                        {
                          sizeLabel[
                            ad.ad_size
                          ]
                        }
                      </span>

                      <span className="rounded-full bg-[#EEE8DF] px-2 py-1 text-[9px] font-black">
                        {orientationLabel(
                          ad.orientation,
                        )}
                      </span>

                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-black ${getPaymentClasses(
                          ad.payment_status,
                        )}`}
                      >
                        {paymentLabel(
                          ad.payment_status,
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredAds.length ===
              0 && (
              <div className="rounded-2xl border-2 border-dashed border-black/10 p-8 text-center text-sm font-bold text-[#756C61]">
                조건에 맞는 광고가
                없습니다.
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 페이지 편집 영역 */}
      <section className="min-w-0 space-y-4">
        <div className="rounded-[28px] bg-white p-5 shadow-lg">
          <div className="flex flex-row items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#C4483A]">
                Page Builder
              </p>

              <h2 className="mt-1 text-2xl font-black">
                페이지 편집
              </h2>

              <p className="mt-2 text-sm font-bold text-[#756C61]">
                레이아웃을 선택해
                페이지를 만든 뒤 왼쪽
                광고를 빈칸으로 끌어다
                놓으세요.
              </p>
            </div>

            <div className="flex w-full max-w-4xl flex-col items-end gap-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-800">
                  ● {formatSavedTime(lastSavedAt)}
                </span>

                <span className="text-[11px] font-bold text-[#756C61]">
                  변경 내용은 작업할 때마다 자동 저장됩니다.
                </span>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={isCheckingSave}
                  onClick={() => {
                    void verifySavedData();
                  }}
                  className="rounded-2xl bg-[#172033] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCheckingSave
                    ? "저장 확인 중..."
                    : "💾 저장 확인"}
                </button>

                <button
                  type="button"
                  onClick={openPreview}
                  className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-black text-[#172033] hover:bg-slate-300"
                >
                  👁 미리보기
                </button>

                <button
                  type="button"
                  onClick={showPdfNotice}
                  className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-black text-[#172033] hover:bg-slate-300"
                >
                  📄 PDF
                </button>

                <button
                  type="button"
                  onClick={openPreview}
                  className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-black text-[#172033] hover:bg-slate-300"
                >
                  📖 플립북
                </button>

                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => {
                    void publishMagazine();
                  }}
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPublishing
                    ? "발행 중..."
                    : "🚀 발행"}
                </button>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <select
                  value={selectedLayout}
                  onChange={(event) => {
                    const nextLayout =
                      event.target.value as AdPageLayoutType;

                    void changeSelectedPageLayout(
                      nextLayout,
                    );
                  }}
                  disabled={isChangingLayout}
                  className="rounded-2xl border border-black/10 bg-[#F7F4EF] px-4 py-3 text-sm font-black outline-none disabled:opacity-50"
                >
                  {MAGAZINE_LAYOUT_LIST.map(
                    (layout) => (
                      <option
                        key={layout.id}
                        value={layout.id}
                      >
                        {layout.name}
                      </option>
                    ),
                  )}

                  <option value="custom">
                    자유 분할·합치기
                  </option>
                </select>

                <button
                  type="button"
                  disabled={
                    !selectedPage ||
                    isChangingLayout
                  }
                  onClick={() => {
                    void changeSelectedPageLayout(
                      "custom",
                    );
                  }}
                  className="rounded-2xl bg-[#172033] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isChangingLayout
                    ? "전환 중..."
                    : "✂ 자유 편집"}
                </button>

                <button
                  type="button"
                  disabled={
                    isAddingPage ||
                    isChangingLayout
                  }
                  onClick={addPage}
                  className="rounded-2xl bg-[#C4483A] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAddingPage
                    ? "페이지 생성 중..."
                    : "➕ 페이지 추가"}
                </button>
              </div>
            </div>
          </div>

          {isChangingLayout && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
              현재 페이지 레이아웃을 변경하고 있습니다...
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-2xl border border-black/10 bg-[#F7F4EF] px-4 py-3 text-sm font-bold">
              {message}
            </div>
          )}
        </div>

        {/* 페이지 선택 탭 */}
        <div className="rounded-[24px] bg-white p-3 shadow-sm">
          <div className="mb-2 flex flex-row items-center justify-between gap-1 px-1">
            <p className="text-xs font-black text-[#756C61]">
              전체 {pages.length}페이지
            </p>

            <p className="text-xs font-bold text-[#756C61]">
              편집할 페이지를 선택하세요.
            </p>
          </div>

          {pages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...pages]
                .sort(
                  (a, b) =>
                    a.page_number -
                    b.page_number,
                )
                .map((page) => {
                  const active =
                    selectedPageId ===
                    page.id;

                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        setSelectedPageId(
                          page.id,
                        );

                        setSelectedLayout(
                          page.layout_type,
                        );

                        setSelectedAdId(null);

                        setMessage(
                          `Page ${page.page_number}을 선택했습니다.`,
                        );
                      }}
                      className={
                        active
                          ? "min-w-[92px] rounded-2xl bg-[#172033] px-5 py-3 text-sm font-black text-white shadow-md"
                          : "min-w-[92px] rounded-2xl bg-[#EEE8DF] px-5 py-3 text-sm font-black text-[#5F574D] hover:bg-[#DDD5CA]"
                      }
                    >
                      Page{" "}
                      {page.page_number}
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-black/10 p-6 text-center text-sm font-bold text-[#756C61]">
              만들어진 페이지가 없습니다.
            </div>
          )}
        </div>

        {!selectedPage ? (
          <div className="rounded-[28px] border-2 border-dashed border-black/15 bg-white/60 p-14 text-center">
            <p className="text-xl font-black">
              아직 페이지가 없습니다.
            </p>

            <p className="mt-2 text-sm font-bold text-[#756C61]">
              위에서 레이아웃을
              선택하고 페이지 추가를
              누르세요.
            </p>
          </div>
        ) : (
          <div className="rounded-[28px] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">
                  Page{" "}
                  {
                    selectedPage.page_number
                  }
                </h3>

                <p className="mt-1 text-xs font-bold text-[#756C61]">
                  {selectedPage.layout_type ===
                  "custom"
                    ? "자유 분할·합치기"
                    : getMagazineLayout(
                        selectedPage.layout_type,
                      )?.name ||
                      "레이아웃"}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  busyPageId ===
                  selectedPage.id
                }
                onClick={() =>
                  deletePage(
                    selectedPage,
                  )
                }
                className="rounded-full border border-red-200 px-4 py-2 text-xs font-black text-red-700 disabled:opacity-50"
              >
                페이지 삭제
              </button>
            </div>

            {selectedPage.layout_type !== "custom" && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                현재 페이지는{" "}
                <strong>
                  {getMagazineLayout(
                    selectedPage.layout_type,
                  )?.name || "고정 레이아웃"}
                </strong>{" "}
                고정 레이아웃입니다.
                위의 <strong>자유 편집 시작</strong> 버튼을 누르면 칸을 직접 나누고 합칠 수 있습니다.
              </div>
            )}

            {selectedPage.layout_type === "custom" ? (
              <CustomLayoutEditor
                key={`${selectedPage.id}-${selectedPage.layout_type}`}
                page={selectedPage}
                pageSlots={selectedPageSlots}
                ads={initialAds}
                selectedAdId={selectedAdId}
                onSelectedAdIdChange={setSelectedAdId}
                onPageChange={(updatedPage) => {
                  setPages((current) =>
                    current.map((page) =>
                      page.id === updatedPage.id
                        ? updatedPage
                        : page,
                    ),
                  );
                }}
                onSlotsChange={(nextPageSlots) => {
                  setSlots((current) => [
                    ...current.filter(
                      (slot) =>
                        slot.page_id !== selectedPage.id,
                    ),
                    ...nextPageSlots,
                  ]);
                }}
                onMessage={setMessage}
              />
            ) : (
              <>
                            <div className="mx-auto aspect-[420/594] w-full max-w-[630px] overflow-hidden border border-black/15 bg-white shadow-2xl">
                              <div
                                className="grid h-full w-full"
                                style={{
                                  gridTemplateColumns:
                                    "repeat(6, minmax(0, 1fr))",
                                  gridTemplateRows:
                                    "repeat(6, minmax(0, 1fr))",
                                }}
                              >
                                {selectedPageSlots.map(
                                  (slot) => {
                                    const ad =
                                      slot.ad_id
                                        ? adMap.get(
                                            slot.ad_id,
                                          )
                                        : null;

                                    const busy =
                                      busySlotId ===
                                      slot.id;

                                    return (
                                      <div
                                        key={
                                          slot.id
                                        }
                                        onDragEnter={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                        }}
                                        onDragOver={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          event.dataTransfer.dropEffect =
                                            "copy";
                                        }}
                                        onDrop={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void handleDrop(event, slot);
                                        }}
                                        onClick={() => {
                                          if (
                                            !slot.ad_id &&
                                            selectedAdId
                                          ) {
                                            void placeAdInSlot(
                                              slot,
                                              selectedAdId,
                                            );
                                          }
                                        }}
                                        className={`group relative min-h-0 min-w-0 overflow-hidden border border-dashed bg-[#F8F5F0] ${
                                          !slot.ad_id && selectedAdId
                                            ? "cursor-pointer border-[#C4483A] ring-2 ring-inset ring-[#C4483A]/30"
                                            : "border-black/25"
                                        }`}
                                        style={{
                                          gridColumnStart:
                                            slot.grid_column_start,
                                          gridRowStart:
                                            slot.grid_row_start,
                                          gridColumnEnd: `span ${slot.grid_column_span}`,
                                          gridRowEnd: `span ${slot.grid_row_span}`,
                                        }}
                                      >
                                        {ad ? (
                                          <>
                                            <img
                                              src={
                                                ad.image_url
                                              }
                                              alt={`${ad.business_name} 광고`}
                                              className="pointer-events-none absolute inset-0 h-full w-full select-none"
                                              style={{
                                                objectFit:
                                                  ad.object_fit ||
                                                  "cover",
                                              }}
                                            />

                                            <div className="absolute inset-x-0 bottom-0 bg-black/75 p-2 text-white opacity-0 transition group-hover:opacity-100">
                                              <p className="truncate text-[10px] font-black">
                                                {
                                                  ad.business_name
                                                }
                                              </p>
                                            </div>

                                            <button
                                              type="button"
                                              disabled={
                                                busy
                                              }
                                              onClick={() =>
                                                clearSlot(
                                                  slot,
                                                )
                                              }
                                              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/80 text-lg font-black text-white opacity-100 transition xl:h-7 xl:w-7 xl:text-sm xl:opacity-0 xl:group-hover:opacity-100 disabled:opacity-50"
                                              title="광고 제거"
                                            >
                                              ×
                                            </button>
                                          </>
                                        ) : (
                                          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center">
                                            <p className="text-xs font-black">
                                              {
                                                sizeLabel[
                                                  slot
                                                    .expected_ad_size
                                                ]
                                              }
                                            </p>

                                            <p className="mt-1 text-[10px] font-bold text-[#756C61]">
                                              {orientationLabel(
                                                slot.expected_orientation,
                                              )}
                                            </p>

                                            <p className="mt-3 text-[10px] font-bold text-[#9A9186]">
                                              광고를 여기로
                                              끌어오세요
                                            </p>
                                          </div>
                                        )}

                                        {busy && (
                                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 text-xs font-black">
                                            저장 중...
                                          </div>
                                        )}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>

                            <p className="mt-4 text-center text-xs font-bold text-[#756C61]">
                              광고를 끌어 원하는 칸에 놓으세요. 드래그가 안 되면
                              왼쪽 광고를 한 번 클릭한 뒤 오른쪽 빈칸을 클릭하세요.
                            </p>
              </>
            )}
          </div>
        )}
          </section>
        </div>
      </div>
    </div>
  );
}