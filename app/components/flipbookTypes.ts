export type FlipbookAdSize = 1 | 2 | 3 | 4 | 5;

export type FlipbookAdOrientation =
  | "horizontal"
  | "vertical"
  | "square";

export type FlipbookImageFit =
  | "cover"
  | "contain"
  | "fill";

export type FlipbookAd = {
  id: number | string;
  business_id: number;
  ad_size: FlipbookAdSize;
  image_url: string;
  enabled: boolean;

  priority?: number | null;
  business_name?: string | null;
  website_url?: string | null;
  show_size_badge?: boolean;

  /*
   * 광고 방향
   *
   * 전체면: vertical
   * 가로 반면: horizontal
   * 세로 반면: vertical
   * 1/4면: square 또는 vertical
   */
  orientation?: FlipbookAdOrientation | null;

  /*
   * 페이지 편집기에서 저장한 정확한 위치입니다.
   * 값이 없으면 기존 자동 배치 크기를 사용합니다.
   */
  grid_column_start?: number;
  grid_row_start?: number;
  grid_column_span?: number;
  grid_row_span?: number;

  /*
   * 잡지 페이지 안에서 해당 광고가 들어간 칸의 이름입니다.
   *
   * 예:
   * full
   * top
   * bottom
   * top-left
   * bottom-right
   */
  slot_key?: string | null;

  /*
   * 이미지 표시 방법입니다.
   *
   * cover   : 비율을 유지하고 칸을 꽉 채움
   * contain : 광고 전체를 보여주고 남는 공간 허용
   * fill    : 칸에 강제로 맞춤
   */
  object_fit?: FlipbookImageFit;

  /*
   * 광고 클릭 시 이동할 주소입니다.
   * 없으면 website_url을 사용합니다.
   */
  click_url?: string | null;
};

export type AdPageLayoutType =
  | "full"
  | "half-horizontal"
  | "half-vertical"
  | "quarters"
  | "half-top-quarters-bottom"
  | "quarters-top-half-bottom"
  | "custom";

export type AdPage = {
  id: number | string;
  ads: FlipbookAd[];

  page_number?: number;
  layout_type?: AdPageLayoutType;
  issue_id?: number | string;
};


