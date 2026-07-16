import type {
  AdPageLayoutType,
  FlipbookAdOrientation,
  FlipbookAdSize,
} from "./flipbookTypes";

export type MagazineSlot = {
  key: string;
  label: string;

  /*
   * 이 칸에 허용되는 광고 크기입니다.
   */
  adSize: FlipbookAdSize;

  /*
   * 광고 방향입니다.
   */
  orientation: FlipbookAdOrientation;

  /*
   * 6×6 그리드 안의 실제 위치입니다.
   */
  gridColumnStart: number;
  gridRowStart: number;
  gridColumnSpan: number;
  gridRowSpan: number;
};

export type MagazineLayout = {
  id: AdPageLayoutType;
  name: string;
  description: string;
  slots: MagazineSlot[];
};

/*
 * 전체 페이지는 6×6 그리드를 사용합니다.
 *
 * 가로:
 * column 1~6
 *
 * 세로:
 * row 1~6
 */
export const MAGAZINE_LAYOUTS: Record<
  AdPageLayoutType,
  MagazineLayout
> = {
  full: {
    id: "full",
    name: "전체면",
    description: "광고 한 개가 한 페이지 전체를 차지합니다.",
    slots: [
      {
        key: "full",
        label: "전체면",
        adSize: 1,
        orientation: "vertical",
        gridColumnStart: 1,
        gridRowStart: 1,
        gridColumnSpan: 6,
        gridRowSpan: 6,
      },
    ],
  },

  "half-horizontal": {
    id: "half-horizontal",
    name: "가로 반면 2개",
    description: "페이지 위와 아래에 가로 반면 광고를 배치합니다.",
    slots: [
      {
        key: "top",
        label: "위쪽 반면",
        adSize: 2,
        orientation: "horizontal",
        gridColumnStart: 1,
        gridRowStart: 1,
        gridColumnSpan: 6,
        gridRowSpan: 3,
      },
      {
        key: "bottom",
        label: "아래쪽 반면",
        adSize: 2,
        orientation: "horizontal",
        gridColumnStart: 1,
        gridRowStart: 4,
        gridColumnSpan: 6,
        gridRowSpan: 3,
      },
    ],
  },

  "half-vertical": {
    id: "half-vertical",
    name: "세로 반면 2개",
    description: "페이지 왼쪽과 오른쪽에 세로 반면 광고를 배치합니다.",
    slots: [
      {
        key: "left",
        label: "왼쪽 반면",
        adSize: 2,
        orientation: "vertical",
        gridColumnStart: 1,
        gridRowStart: 1,
        gridColumnSpan: 3,
        gridRowSpan: 6,
      },
      {
        key: "right",
        label: "오른쪽 반면",
        adSize: 2,
        orientation: "vertical",
        gridColumnStart: 4,
        gridRowStart: 1,
        gridColumnSpan: 3,
        gridRowSpan: 6,
      },
    ],
  },

  quarters: {
    id: "quarters",
    name: "1/4면 4개",
    description: "페이지를 네 칸으로 나눠 1/4면 광고를 배치합니다.",
    slots: [
      {
        key: "top-left",
        label: "왼쪽 위",
        adSize: 3,
        orientation: "square",
        gridColumnStart: 1,
        gridRowStart: 1,
        gridColumnSpan: 3,
        gridRowSpan: 3,
      },
      {
        key: "top-right",
        label: "오른쪽 위",
        adSize: 3,
        orientation: "square",
        gridColumnStart: 4,
        gridRowStart: 1,
        gridColumnSpan: 3,
        gridRowSpan: 3,
      },
      {
        key: "bottom-left",
        label: "왼쪽 아래",
        adSize: 3,
        orientation: "square",
        gridColumnStart: 1,
        gridRowStart: 4,
        gridColumnSpan: 3,
        gridRowSpan: 3,
      },
      {
        key: "bottom-right",
        label: "오른쪽 아래",
        adSize: 3,
        orientation: "square",
        gridColumnStart: 4,
        gridRowStart: 4,
        gridColumnSpan: 3,
        gridRowSpan: 3,
      },
    ],
  },

  "half-top-quarters-bottom": {
    id: "half-top-quarters-bottom",
    name: "위 반면 + 아래 1/4면 2개",
    description:
      "페이지 위쪽에 반면 광고, 아래쪽에 1/4면 광고 두 개를 배치합니다.",
    slots: [
      {
        key: "top",
        label: "위쪽 반면",
        adSize: 2,
        orientation: "horizontal",
        gridColumnStart: 1,
        gridRowStart: 1,
        gridColumnSpan: 6,
        gridRowSpan: 3,
      },
      {
        key: "bottom-left",
        label: "왼쪽 아래 1/4면",
        adSize: 3,
        orientation: "square",
        gridColumnStart: 1,
        gridRowStart: 4,
        gridColumnSpan: 3,
        gridRowSpan: 3,
      },
      {
        key: "bottom-right",
        label: "오른쪽 아래 1/4면",
        adSize: 3,
        orientation: "square",
        gridColumnStart: 4,
        gridRowStart: 4,
        gridColumnSpan: 3,
        gridRowSpan: 3,
      },
    ],
  },

  "quarters-top-half-bottom": {
    id: "quarters-top-half-bottom",
    name: "위 1/4면 2개 + 아래 반면",
    description:
      "페이지 위쪽에 1/4면 광고 두 개, 아래쪽에 반면 광고를 배치합니다.",
    slots: [
      {
        key: "top-left",
        label: "왼쪽 위 1/4면",
        adSize: 3,
        orientation: "square",
        gridColumnStart: 1,
        gridRowStart: 1,
        gridColumnSpan: 3,
        gridRowSpan: 3,
      },
      {
        key: "top-right",
        label: "오른쪽 위 1/4면",
        adSize: 3,
        orientation: "square",
        gridColumnStart: 4,
        gridRowStart: 1,
        gridColumnSpan: 3,
        gridRowSpan: 3,
      },
      {
        key: "bottom",
        label: "아래쪽 반면",
        adSize: 2,
        orientation: "horizontal",
        gridColumnStart: 1,
        gridRowStart: 4,
        gridColumnSpan: 6,
        gridRowSpan: 3,
      },
    ],
  },

  custom: {
    id: "custom",
    name: "자유 배치",
    description: "관리자가 광고 위치와 크기를 직접 지정합니다.",
    slots: [],
  },
};

export const MAGAZINE_LAYOUT_LIST = Object.values(
  MAGAZINE_LAYOUTS,
).filter((layout) => layout.id !== "custom");

export function getMagazineLayout(
  layoutType: AdPageLayoutType,
) {
  return MAGAZINE_LAYOUTS[layoutType];
}

export function getMagazineSlot(
  layoutType: AdPageLayoutType,
  slotKey: string,
) {
  const layout = getMagazineLayout(layoutType);

  return (
    layout.slots.find((slot) => slot.key === slotKey) ||
    null
  );
}

export function isAdCompatibleWithSlot(
  ad: {
    ad_size: FlipbookAdSize;
    orientation?: FlipbookAdOrientation | null;
  },
  slot: MagazineSlot,
) {
  /*
   * 광고 상품 크기만 일치하면 배치합니다.
   *
   * 기존 광고는 orientation 값이 정확하지 않을 수 있으므로
   * 초기 편집기에서는 방향으로 배치를 막지 않습니다.
   *
   * 이미지 비율 문제는 object_fit으로 처리합니다.
   */
  return ad.ad_size === slot.adSize;
}