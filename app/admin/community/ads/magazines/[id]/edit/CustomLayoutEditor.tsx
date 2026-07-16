"use client";

import {
  DragEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../../../../../../lib/supabase";
import type {
  MagazineAdLibraryRow,
  MagazinePageEditorRow,
  MagazineSlotEditorRow,
} from "./page";

type LeafNode = {
  id: string;
  type: "leaf";
};

type SplitNode = {
  id: string;
  type: "split";
  direction: "horizontal" | "vertical";
  children: [CustomNode, CustomNode];
};

type CustomNode = LeafNode | SplitNode;

type CustomLayoutDocument = {
  version: 1;
  root: CustomNode;
};

type Props = {
  page: MagazinePageEditorRow;
  pageSlots: MagazineSlotEditorRow[];
  ads: MagazineAdLibraryRow[];
  selectedAdId: string | null;
  onSelectedAdIdChange: (id: string | null) => void;
  onPageChange: (page: MagazinePageEditorRow) => void;
  onSlotsChange: (slots: MagazineSlotEditorRow[]) => void;
  onMessage: (message: string | null) => void;
};

const AD_DRAG_TYPE = "application/x-ktown-ad";

function makeId(prefix: "leaf" | "split") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function defaultDocument(): CustomLayoutDocument {
  return {
    version: 1,
    root: {
      id: makeId("leaf"),
      type: "leaf",
    },
  };
}

function parseDocument(
  value: MagazinePageEditorRow["layout_json"],
): CustomLayoutDocument {
  if (
    value &&
    typeof value === "object" &&
    "root" in value
  ) {
    return value as CustomLayoutDocument;
  }

  return defaultDocument();
}

function replaceNode(
  node: CustomNode,
  nodeId: string,
  replacement: CustomNode,
): CustomNode {
  if (node.id === nodeId) {
    return replacement;
  }

  if (node.type === "split") {
    return {
      ...node,
      children: [
        replaceNode(node.children[0], nodeId, replacement),
        replaceNode(node.children[1], nodeId, replacement),
      ],
    };
  }

  return node;
}

function findNode(
  node: CustomNode,
  nodeId: string,
): CustomNode | null {
  if (node.id === nodeId) {
    return node;
  }

  if (node.type === "split") {
    return (
      findNode(node.children[0], nodeId) ||
      findNode(node.children[1], nodeId)
    );
  }

  return null;
}

function findParent(
  node: CustomNode,
  childId: string,
): SplitNode | null {
  if (node.type !== "split") {
    return null;
  }

  if (
    node.children[0].id === childId ||
    node.children[1].id === childId
  ) {
    return node;
  }

  return (
    findParent(node.children[0], childId) ||
    findParent(node.children[1], childId)
  );
}

function collectLeafIds(node: CustomNode): string[] {
  if (node.type === "leaf") {
    return [node.id];
  }

  return [
    ...collectLeafIds(node.children[0]),
    ...collectLeafIds(node.children[1]),
  ];
}


type GridRect = {
  columnStart: number;
  rowStart: number;
  columnSpan: number;
  rowSpan: number;
};

const ROOT_GRID_RECT: GridRect = {
  columnStart: 1,
  rowStart: 1,
  columnSpan: 6,
  rowSpan: 6,
};

/*
 * layout_json의 분할 트리를 공개 플립북이 사용하는 6×6 좌표로 변환합니다.
 *
 * horizontal = 위·아래 분할
 * vertical   = 좌·우 분할
 *
 * 홀수 크기의 영역을 나눌 때 첫 번째 영역에 작은 쪽을,
 * 두 번째 영역에 남은 크기를 배정합니다.
 */
function collectLeafGridRects(
  node: CustomNode,
  rect: GridRect = ROOT_GRID_RECT,
  result = new Map<string, GridRect>(),
) {
  if (node.type === "leaf") {
    result.set(node.id, rect);
    return result;
  }

  if (node.direction === "horizontal") {
    const firstRowSpan = Math.max(
      1,
      Math.floor(rect.rowSpan / 2),
    );
    const secondRowSpan = Math.max(
      1,
      rect.rowSpan - firstRowSpan,
    );

    collectLeafGridRects(
      node.children[0],
      {
        columnStart: rect.columnStart,
        rowStart: rect.rowStart,
        columnSpan: rect.columnSpan,
        rowSpan: firstRowSpan,
      },
      result,
    );

    collectLeafGridRects(
      node.children[1],
      {
        columnStart: rect.columnStart,
        rowStart:
          rect.rowStart + firstRowSpan,
        columnSpan: rect.columnSpan,
        rowSpan: secondRowSpan,
      },
      result,
    );

    return result;
  }

  const firstColumnSpan = Math.max(
    1,
    Math.floor(rect.columnSpan / 2),
  );
  const secondColumnSpan = Math.max(
    1,
    rect.columnSpan - firstColumnSpan,
  );

  collectLeafGridRects(
    node.children[0],
    {
      columnStart: rect.columnStart,
      rowStart: rect.rowStart,
      columnSpan: firstColumnSpan,
      rowSpan: rect.rowSpan,
    },
    result,
  );

  collectLeafGridRects(
    node.children[1],
    {
      columnStart:
        rect.columnStart + firstColumnSpan,
      rowStart: rect.rowStart,
      columnSpan: secondColumnSpan,
      rowSpan: rect.rowSpan,
    },
    result,
  );

  return result;
}

function slotHasRect(
  slot: MagazineSlotEditorRow,
  rect: GridRect,
) {
  return (
    Number(slot.grid_column_start) ===
      rect.columnStart &&
    Number(slot.grid_row_start) ===
      rect.rowStart &&
    Number(slot.grid_column_span) ===
      rect.columnSpan &&
    Number(slot.grid_row_span) ===
      rect.rowSpan
  );
}

function getDraggedAdId(
  event: DragEvent<HTMLElement>,
) {
  const custom = event.dataTransfer.getData(
    AD_DRAG_TYPE,
  );

  if (custom) {
    try {
      const parsed = JSON.parse(custom) as {
        adId?: string;
      };

      if (parsed.adId) {
        return parsed.adId;
      }
    } catch {
      // text/plain으로 다시 시도합니다.
    }
  }

  return (
    event.dataTransfer.getData("text/plain") ||
    null
  );
}

export default function CustomLayoutEditor({
  page,
  pageSlots,
  ads,
  selectedAdId,
  onSelectedAdIdChange,
  onPageChange,
  onSlotsChange,
  onMessage,
}: Props) {
  const [document, setDocument] =
    useState<CustomLayoutDocument>(() =>
      parseDocument(page.layout_json),
    );

  const [busy, setBusy] = useState(false);
  const [isInitializing, setIsInitializing] =
    useState(false);
  const [isSyncingCoordinates, setIsSyncingCoordinates] =
    useState(false);
  const [activeLeafId, setActiveLeafId] =
    useState<string | null>(null);

  const adMap = useMemo(
    () =>
      new Map(
        ads.map((ad) => [ad.id, ad]),
      ),
    [ads],
  );

  const slotMap = useMemo(
    () =>
      new Map(
        pageSlots.map((slot) => [
          slot.slot_key,
          slot,
        ]),
      ),
    [pageSlots],
  );
  const activeNode = useMemo(
    () =>
      activeLeafId
        ? findNode(document.root, activeLeafId)
        : null,
    [activeLeafId, document.root],
  );

  const activeSlot =
    activeLeafId
      ? slotMap.get(activeLeafId) || null
      : null;

  const activeAd =
    activeSlot?.ad_id
      ? adMap.get(activeSlot.ad_id) || null
      : null;

  /*
   * 기존 custom 페이지에 layout_json만 있고 슬롯이 없거나,
   * 이전 작업 중 슬롯 생성이 실패한 경우를 자동 복구합니다.
   */
  useEffect(() => {
    const leafIds = collectLeafIds(document.root);
    const missingLeafIds = leafIds.filter(
      (leafId) => !slotMap.has(leafId),
    );

    if (
      missingLeafIds.length === 0 ||
      isInitializing
    ) {
      return;
    }

    let cancelled = false;

    const initializeMissingSlots = async () => {
      setIsInitializing(true);

      try {
        const leafRects =
          collectLeafGridRects(document.root);

        const rows = missingLeafIds.map(
          (leafId, index) => {
            const rect =
              leafRects.get(leafId) ||
              ROOT_GRID_RECT;

            return {
              page_id: page.id,
              slot_key: leafId,
              ad_id: null,
              expected_ad_size: 1,
              expected_orientation: null,
              grid_column_start:
                rect.columnStart,
              grid_row_start:
                rect.rowStart,
              grid_column_span:
                rect.columnSpan,
              grid_row_span:
                rect.rowSpan,
              sort_order:
                pageSlots.length + index,
            };
          },
        );

        const { data, error } = await supabase
          .from("magazine_page_slots")
          .insert(rows)
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

        if (error) {
          throw error;
        }

        if (!cancelled) {
          onSlotsChange([
            ...pageSlots,
            ...((data || []) as MagazineSlotEditorRow[]),
          ]);

          onMessage(
            "자유 레이아웃 편집 준비가 완료되었습니다. 페이지 칸을 클릭하세요.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "자유 레이아웃 슬롯을 준비하지 못했습니다.";

          onMessage(`오류: ${message}`);
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void initializeMissingSlots();

    return () => {
      cancelled = true;
    };
  }, [
    document.root,
    isInitializing,
    onMessage,
    onSlotsChange,
    page.id,
    pageSlots,
    slotMap,
  ]);

  /*
   * 과거 버전에서 모든 자유 슬롯이 1,1,6,6으로 저장된 데이터를 자동 수정합니다.
   * 편집 페이지를 열기만 해도 layout_json 기준 좌표가 DB와 로컬 상태에 동기화됩니다.
   */
  useEffect(() => {
    if (
      isInitializing ||
      isSyncingCoordinates ||
      pageSlots.length === 0
    ) {
      return;
    }

    const leafRects =
      collectLeafGridRects(document.root);

    const slotsToUpdate = pageSlots.filter(
      (slot) => {
        const rect = leafRects.get(
          slot.slot_key,
        );

        return rect
          ? !slotHasRect(slot, rect)
          : false;
      },
    );

    if (slotsToUpdate.length === 0) {
      return;
    }

    let cancelled = false;

    const syncCoordinates = async () => {
      setIsSyncingCoordinates(true);

      try {
        const updatedById = new Map<
          number,
          MagazineSlotEditorRow
        >();

        for (const slot of slotsToUpdate) {
          const rect = leafRects.get(
            slot.slot_key,
          );

          if (!rect) continue;

          const { data, error } =
            await supabase
              .from("magazine_page_slots")
              .update({
                grid_column_start:
                  rect.columnStart,
                grid_row_start:
                  rect.rowStart,
                grid_column_span:
                  rect.columnSpan,
                grid_row_span:
                  rect.rowSpan,
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
                "자유 레이아웃 좌표를 저장하지 못했습니다.",
              )
            );
          }

          updatedById.set(
            slot.id,
            data as MagazineSlotEditorRow,
          );
        }

        if (!cancelled) {
          onSlotsChange(
            pageSlots.map((slot) =>
              updatedById.get(slot.id) ||
              slot,
            ),
          );

          onMessage(
            "자유 레이아웃 좌표를 플립북과 동일하게 동기화했습니다.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "자유 레이아웃 좌표를 동기화하지 못했습니다.";

          onMessage(`오류: ${message}`);
        }
      } finally {
        if (!cancelled) {
          setIsSyncingCoordinates(false);
        }
      }
    };

    void syncCoordinates();

    return () => {
      cancelled = true;
    };
  }, [
    document.root,
    isInitializing,
    isSyncingCoordinates,
    onMessage,
    onSlotsChange,
    pageSlots,
  ]);

  const saveDocument = async (
    nextDocument: CustomLayoutDocument,
  ) => {
    const { data, error } = await supabase
      .from("magazine_pages")
      .update({
        layout_type: "custom",
        layout_json: nextDocument,
      })
      .eq("id", page.id)
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

    if (error || !data) {
      throw (
        error ||
        new Error("자유 레이아웃을 저장하지 못했습니다.")
      );
    }

    setDocument(nextDocument);
    onPageChange(
      data as MagazinePageEditorRow,
    );
  };

  const splitLeaf = async (
    leafId: string,
    direction: "horizontal" | "vertical",
  ) => {
    if (busy) return;

    const leaf = findNode(
      document.root,
      leafId,
    );

    if (!leaf || leaf.type !== "leaf") {
      return;
    }

    const oldSlot = slotMap.get(leafId);
    const firstLeaf: LeafNode = {
      id: makeId("leaf"),
      type: "leaf",
    };
    const secondLeaf: LeafNode = {
      id: makeId("leaf"),
      type: "leaf",
    };
    const split: SplitNode = {
      id: makeId("split"),
      type: "split",
      direction,
      children: [firstLeaf, secondLeaf],
    };

    const nextDocument: CustomLayoutDocument = {
      ...document,
      root: replaceNode(
        document.root,
        leafId,
        split,
      ),
    };

    /*
     * 버튼을 누르는 즉시 화면을 먼저 나눕니다.
     * DB 저장이 늦거나 실패해도 클릭 반응을 바로 확인할 수 있습니다.
     */
    const previousDocument = document;
    setDocument(nextDocument);
    setBusy(true);
    onMessage(
      direction === "horizontal"
        ? "화면을 위·아래로 나눴습니다. 저장 중..."
        : "화면을 좌·우로 나눴습니다. 저장 중...",
    );

    try {
      await saveDocument(nextDocument);

      if (oldSlot) {
        const { error } = await supabase
          .from("magazine_page_slots")
          .delete()
          .eq("id", oldSlot.id);

        if (error) throw error;
      }

      const nextLeafRects =
        collectLeafGridRects(
          nextDocument.root,
        );

      const firstRect =
        nextLeafRects.get(firstLeaf.id) ||
        ROOT_GRID_RECT;

      const secondRect =
        nextLeafRects.get(secondLeaf.id) ||
        ROOT_GRID_RECT;

      const { data, error } = await supabase
        .from("magazine_page_slots")
        .insert([
          {
            page_id: page.id,
            slot_key: firstLeaf.id,
            ad_id: oldSlot?.ad_id || null,
            expected_ad_size: 1,
            expected_orientation: null,
            grid_column_start:
              firstRect.columnStart,
            grid_row_start:
              firstRect.rowStart,
            grid_column_span:
              firstRect.columnSpan,
            grid_row_span:
              firstRect.rowSpan,
            sort_order:
              oldSlot?.sort_order ??
              pageSlots.length,
          },
          {
            page_id: page.id,
            slot_key: secondLeaf.id,
            ad_id: null,
            expected_ad_size: 1,
            expected_orientation: null,
            grid_column_start:
              secondRect.columnStart,
            grid_row_start:
              secondRect.rowStart,
            grid_column_span:
              secondRect.columnSpan,
            grid_row_span:
              secondRect.rowSpan,
            sort_order:
              (oldSlot?.sort_order ??
                pageSlots.length) + 1,
          },
        ])
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

      if (error) throw error;

      onSlotsChange([
        ...pageSlots.filter(
          (slot) => slot.slot_key !== leafId,
        ),
        ...((data || []) as MagazineSlotEditorRow[]),
      ]);

      setActiveLeafId(null);
      onMessage(
        direction === "horizontal"
          ? "선택한 칸을 위·아래로 나눴습니다."
          : "선택한 칸을 왼쪽·오른쪽으로 나눴습니다.",
      );
    } catch (error) {
      setDocument(previousDocument);

      const message =
        error instanceof Error
          ? error.message
          : "칸을 나누지 못했습니다.";

      onMessage(
        `저장 오류로 원래 레이아웃으로 되돌렸습니다: ${message}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const mergeAtNode = async (
    nodeId: string,
  ) => {
    if (busy) return;

    const target = findNode(
      document.root,
      nodeId,
    );

    if (!target || target.type !== "split") {
      return;
    }

    const descendantIds =
      collectLeafIds(target);

    const descendantSlots =
      pageSlots.filter((slot) =>
        descendantIds.includes(slot.slot_key),
      );

    const assignedAds = descendantSlots.filter(
      (slot) => !!slot.ad_id,
    );

    if (assignedAds.length > 1) {
      const proceed = window.confirm(
        `합칠 영역에 광고가 ${assignedAds.length}개 있습니다.\n\n합치면 첫 번째 광고만 남고 나머지는 제거됩니다. 계속할까요?`,
      );

      if (!proceed) return;
    }

    const mergedLeaf: LeafNode = {
      id: makeId("leaf"),
      type: "leaf",
    };

    const nextDocument: CustomLayoutDocument = {
      ...document,
      root: replaceNode(
        document.root,
        nodeId,
        mergedLeaf,
      ),
    };

    const previousDocument = document;
    setDocument(nextDocument);
    setBusy(true);
    onMessage("선택한 영역을 합쳤습니다. 저장 중...");

    try {
      await saveDocument(nextDocument);

      if (descendantSlots.length > 0) {
        const { error } = await supabase
          .from("magazine_page_slots")
          .delete()
          .in(
            "id",
            descendantSlots.map(
              (slot) => slot.id,
            ),
          );

        if (error) throw error;
      }

      const nextLeafRects =
        collectLeafGridRects(
          nextDocument.root,
        );

      const mergedRect =
        nextLeafRects.get(mergedLeaf.id) ||
        ROOT_GRID_RECT;

      const { data, error } = await supabase
        .from("magazine_page_slots")
        .insert({
          page_id: page.id,
          slot_key: mergedLeaf.id,
          ad_id:
            assignedAds[0]?.ad_id || null,
          expected_ad_size: 1,
          expected_orientation: null,
          grid_column_start:
            mergedRect.columnStart,
          grid_row_start:
            mergedRect.rowStart,
          grid_column_span:
            mergedRect.columnSpan,
          grid_row_span:
            mergedRect.rowSpan,
          sort_order:
            Math.min(
              ...descendantSlots.map(
                (slot) => slot.sort_order,
              ),
              0,
            ),
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

      if (error || !data) {
        throw (
          error ||
          new Error("합친 슬롯을 만들지 못했습니다.")
        );
      }

      onSlotsChange([
        ...pageSlots.filter(
          (slot) =>
            !descendantIds.includes(
              slot.slot_key,
            ),
        ),
        data as MagazineSlotEditorRow,
      ]);

      setActiveLeafId(null);
      onMessage("선택한 영역을 한 칸으로 합쳤습니다.");
    } catch (error) {
      setDocument(previousDocument);

      const message =
        error instanceof Error
          ? error.message
          : "영역을 합치지 못했습니다.";

      onMessage(
        `저장 오류로 원래 레이아웃으로 되돌렸습니다: ${message}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const mergeLeafToParent = async (
    leafId: string,
  ) => {
    const parent = findParent(
      document.root,
      leafId,
    );

    if (!parent) {
      onMessage(
        "이 칸은 가장 바깥쪽 전체 페이지이므로 더 이상 합칠 수 없습니다.",
      );
      return;
    }

    await mergeAtNode(parent.id);
  };

  const placeAd = async (
    leafId: string,
    adId: string,
  ) => {
    const slot = slotMap.get(leafId);
    const ad = adMap.get(adId);

    if (!slot || !ad) {
      onMessage(
        "광고 또는 선택한 칸을 찾지 못했습니다.",
      );
      return;
    }

    setBusy(true);
    onMessage(null);

    try {
      const { data, error } = await supabase
        .from("magazine_page_slots")
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
          new Error("광고를 배치하지 못했습니다.")
        );
      }

      onSlotsChange(
        pageSlots.map((item) =>
          item.id === slot.id
            ? (data as MagazineSlotEditorRow)
            : item,
        ),
      );

      onSelectedAdIdChange(null);
      setActiveLeafId(null);
      onMessage(
        `"${ad.business_name}" 광고를 배치했습니다.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "광고를 배치하지 못했습니다.";

      onMessage(`오류: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const clearAd = async (
    leafId: string,
  ) => {
    const slot = slotMap.get(leafId);

    if (!slot || !slot.ad_id) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from("magazine_page_slots")
        .update({
          ad_id: null,
        })
        .eq("id", slot.id);

      if (error) throw error;

      onSlotsChange(
        pageSlots.map((item) =>
          item.id === slot.id
            ? {
                ...item,
                ad_id: null,
              }
            : item,
        ),
      );

      onMessage("광고를 제거했습니다.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "광고를 제거하지 못했습니다.";

      onMessage(`오류: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const renderNode = (
    node: CustomNode,
    isRoot = false,
  ): React.ReactNode => {
    if (node.type === "split") {
      return (
        <div
          className={`group/split relative flex h-full min-h-0 w-full min-w-0 ${
            node.direction === "horizontal"
              ? "flex-col"
              : "flex-row"
          }`}
        >

          <div className="min-h-0 min-w-0 flex-1">
            {renderNode(node.children[0])}
          </div>

          <div
            className={
              node.direction === "horizontal"
                ? "h-[3px] shrink-0 bg-[#C4483A]"
                : "w-[3px] shrink-0 bg-[#C4483A]"
            }
          />

          <div className="min-h-0 min-w-0 flex-1">
            {renderNode(node.children[1])}
          </div>
        </div>
      );
    }

    const slot = slotMap.get(node.id);
    const ad = slot?.ad_id
      ? adMap.get(slot.ad_id)
      : null;
    const active =
      activeLeafId === node.id;

    return (
      <div
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setActiveLeafId(node.id);
        }}
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

          const adId =
            getDraggedAdId(event);

          if (adId) {
            void placeAd(node.id, adId);
          }
        }}
        className={`group/leaf relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#F8F5F0] ${
          selectedAdId && !ad
            ? "ring-2 ring-inset ring-[#C4483A]/50"
            : ""
        }`}
      >
        {ad ? (
          <>
            <img
              src={ad.image_url}
              alt={`${ad.business_name} 광고`}
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
              style={{
                objectFit:
                  ad.object_fit === "fill"
                    ? "fill"
                    : "contain",
              }}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 p-2 text-white">
              <p className="truncate text-[10px] font-black">
                {ad.business_name}
              </p>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
            <p className="text-[11px] font-black text-[#172033]">
              빈 광고 칸
            </p>
            <p className="mt-1 text-[9px] font-bold text-[#81776B]">
              아래 버튼으로 바로 나누세요
            </p>
          </div>
        )}

        <div className="absolute left-2 top-2 z-40 flex max-w-[calc(100%-16px)] flex-wrap gap-1">
          <button
            type="button"
            disabled={busy}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMessage("위·아래 나누기 버튼을 눌렀습니다.");
              void splitLeaf(
                node.id,
                "horizontal",
              );
            }}
            className="rounded-lg bg-[#172033] px-2 py-1.5 text-[9px] font-black text-white shadow disabled:opacity-40"
          >
            위·아래
          </button>

          <button
            type="button"
            disabled={busy}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMessage("좌·우 나누기 버튼을 눌렀습니다.");
              void splitLeaf(
                node.id,
                "vertical",
              );
            }}
            className="rounded-lg bg-[#172033] px-2 py-1.5 text-[9px] font-black text-white shadow disabled:opacity-40"
          >
            좌·우
          </button>

          {!isRoot && (
            <button
              type="button"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void mergeLeafToParent(
                  node.id,
                );
              }}
              className="rounded-lg bg-amber-100 px-2 py-1.5 text-[9px] font-black text-amber-900 shadow disabled:opacity-40"
            >
              합치기
            </button>
          )}

          {selectedAdId && !ad && (
            <button
              type="button"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void placeAd(
                  node.id,
                  selectedAdId,
                );
              }}
              className="rounded-lg bg-[#C4483A] px-2 py-1.5 text-[9px] font-black text-white shadow disabled:opacity-40"
            >
              광고 넣기
            </button>
          )}

          {ad && (
            <button
              type="button"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void clearAd(node.id);
              }}
              className="rounded-lg bg-red-100 px-2 py-1.5 text-[9px] font-black text-red-700 shadow disabled:opacity-40"
            >
              광고 제거
            </button>
          )}
        </div>

      </div>
    );
  };

  return (
    <>
      <div className="mb-4 rounded-2xl bg-[#F7F4EF] p-4">
        <p className="text-sm font-black">
          자유 분할·합치기
        </p>
        <p className="mt-1 text-xs font-bold text-[#756C61]">
          먼저 아래 페이지에서 원하는 칸을 클릭하세요. 선택된 칸은 노란 테두리로 표시됩니다.
          그다음 아래 버튼으로 나누거나 합칠 수 있습니다.
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <p className="text-xs font-black text-[#756C61]">
          각 칸 안의 버튼을 직접 누르세요. 별도로 칸을 선택할 필요가 없습니다.
        </p>
      </div>

      <div className="mx-auto aspect-[420/594] w-full max-w-[630px] overflow-hidden border border-black/20 bg-white shadow-2xl">
        {renderNode(document.root, true)}
      </div>

      {(busy ||
        isInitializing ||
        isSyncingCoordinates) && (
        <p className="mt-3 text-center text-xs font-black text-[#C4483A]">
          {isInitializing
            ? "자유 레이아웃 칸을 준비하고 있습니다..."
            : isSyncingCoordinates
              ? "플립북용 좌표를 동기화하고 있습니다..."
              : "레이아웃을 저장하고 있습니다..."}
        </p>
      )}

      <p className="mt-3 text-center text-[11px] font-bold text-[#756C61]">
        각 칸 왼쪽 위의 버튼을 직접 눌러 나누거나 합치세요.
      </p>
    </>
  );
}