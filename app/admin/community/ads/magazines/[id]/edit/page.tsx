import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../../../../../../lib/supabase";
import MagazineEditor from "./MagazineEditor";
import type {
  AdPageLayoutType,
  FlipbookAdOrientation,
  FlipbookAdSize,
  FlipbookImageFit,
} from "../../../../../../components/flipbookTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export type CustomLayoutJson =
  | {
      version: 1;
      root: unknown;
    }
  | null;

export type MagazineIssueEditorRow = {
  id: number;
  title: string;
  issue_number: string | null;
  description: string | null;
  publication_date: string | null;
  status: "draft" | "published" | "archived";
  is_public: boolean;
};

export type MagazinePageEditorRow = {
  id: number;
  issue_id: number;
  page_number: number;
  page_type:
    | "cover"
    | "advertisement"
    | "article"
    | "directory"
    | "blank"
    | "back-cover";
  layout_type: AdPageLayoutType;
  layout_json: CustomLayoutJson;
  page_title: string | null;
  background_color: string | null;
  page_image_url: string | null;
};

export type MagazineSlotEditorRow = {
  id: number;
  page_id: number;
  slot_key: string;
  ad_id: string | null;
  expected_ad_size: FlipbookAdSize;
  expected_orientation: FlipbookAdOrientation | null;
  grid_column_start: number;
  grid_row_start: number;
  grid_column_span: number;
  grid_row_span: number;
  sort_order: number;
};

export type MagazineAdLibraryRow = {
  id: string;
  business_id: number;
  ad_size: FlipbookAdSize;
  image_url: string;
  enabled: boolean;
  priority: number | null;
  orientation: FlipbookAdOrientation | null;
  object_fit: FlipbookImageFit | null;
  click_url: string | null;
  ad_title: string | null;
  start_date: string | null;
  end_date: string | null;
  payment_status:
    | "unpaid"
    | "pending"
    | "paid"
    | "refunded"
    | "waived"
    | null;
  amount_paid: number | null;
  business_name: string;
  website_url: string | null;
};

type BusinessRow = {
  id: number;
  name: string | null;
  website_url: string | null;
};

type RawAdRow = {
  id: string | number | null;
  business_id: string | number | null;
  ad_size: string | number | null;
  image_url: string | null;
  enabled: boolean | null;
  priority: string | number | null;
  orientation: FlipbookAdOrientation | null;
  object_fit: FlipbookImageFit | null;
  click_url: string | null;
  ad_title: string | null;
  start_date: string | null;
  end_date: string | null;
  payment_status:
    | "unpaid"
    | "pending"
    | "paid"
    | "refunded"
    | "waived"
    | null;
  amount_paid: string | number | null;
  created_at?: string | null;
};

function normalizeAdSize(
  value: string | number | null,
): FlipbookAdSize | null {
  const numericValue = Number(value);

  if ([1, 2, 3, 4, 5].includes(numericValue)) {
    return numericValue as FlipbookAdSize;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  const aliases: Record<string, FlipbookAdSize> = {
    full: 1,
    "full-page": 1,
    fullpage: 1,
    "전체면": 1,
    half: 2,
    "half-page": 2,
    halfpage: 2,
    "반면": 2,
    quarter: 3,
    "quarter-page": 3,
    quarterpage: 3,
    "1/4": 3,
    "1/4면": 3,
    sixth: 4,
    "sixth-page": 4,
    "1/6": 4,
    "1/6면": 4,
    twelfth: 5,
    "twelfth-page": 5,
    "1/12": 5,
    "1/12면": 5,
  };

  return aliases[normalized] ?? null;
}

function normalizeOrientation(
  value: FlipbookAdOrientation | string | null,
): FlipbookAdOrientation | null {
  if (
    value === "horizontal" ||
    value === "vertical" ||
    value === "square"
  ) {
    return value;
  }

  return null;
}

function normalizeObjectFit(
  value: FlipbookImageFit | string | null,
): FlipbookImageFit {
  if (
    value === "cover" ||
    value === "contain" ||
    value === "fill"
  ) {
    return value;
  }

  return "cover";
}

export default async function MagazineEditPage({
  params,
}: PageProps) {
  const resolvedParams = await params;
  const issueId = Number(resolvedParams.id);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    notFound();
  }

  const { data: issueData, error: issueError } =
    await supabase
      .from("magazine_issues")
      .select(`
        id,
        title,
        issue_number,
        description,
        publication_date,
        status,
        is_public
      `)
      .eq("id", issueId)
      .maybeSingle();

  if (issueError) {
    console.error(
      "Magazine issue load error:",
      issueError,
    );

    return (
      <main className="min-h-screen bg-[#F4EFE7] p-8 text-[#172033]">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-black">
            잡지 정보를 불러오지 못했습니다.
          </h1>

          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {issueError.message}
          </p>

          <Link
            href="/admin/community/ads/magazines"
            className="mt-6 inline-flex rounded-full bg-[#172033] px-5 py-3 text-sm font-black text-white"
          >
            잡지 목록으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  if (!issueData) {
    notFound();
  }

  const { data: pageData, error: pageError } =
    await supabase
      .from("magazine_pages")
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
      .eq("issue_id", issueId)
      .order("page_number", {
        ascending: true,
      });

  if (pageError) {
    console.error(
      "Magazine page load error:",
      pageError,
    );
  }

  const pages =
    (pageData || []) as MagazinePageEditorRow[];

  const pageIds = pages.map((page) => page.id);

  let slots: MagazineSlotEditorRow[] = [];

  if (pageIds.length > 0) {
    const { data: slotData, error: slotError } =
      await supabase
        .from("magazine_page_slots")
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
        .in("page_id", pageIds)
        .order("sort_order", {
          ascending: true,
        });

    if (slotError) {
      console.error(
        "Magazine slot load error:",
        slotError,
      );
    }

    slots =
      (slotData || []) as MagazineSlotEditorRow[];
  }

  /*
   * 편집기에서는 광고 라이브러리에 등록된 이미지를 모두 보여줍니다.
   * enabled가 false인 광고도 확인할 수 있도록 서버 조회 단계에서는
   * enabled 필터를 적용하지 않습니다.
   */
  const { data: rawAdData, error: adError } =
    await supabase
      .from("business_flipbook_ads")
      .select(`
        id,
        business_id,
        ad_size,
        image_url,
        enabled,
        priority,
        orientation,
        object_fit,
        click_url,
        ad_title,
        start_date,
        end_date,
        payment_status,
        amount_paid,
        created_at
      `)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("priority", {
        ascending: false,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: false,
      });

  if (adError) {
    console.error(
      "Advertisement library load error:",
      adError,
    );
  }

  const rawAds =
    (rawAdData || []) as RawAdRow[];

  const businessIds = Array.from(
    new Set(
      rawAds
        .map((ad) => Number(ad.business_id))
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0,
        ),
    ),
  );

  let businessMap =
    new Map<number, BusinessRow>();

  if (businessIds.length > 0) {
    const { data: businessData, error: businessError } =
      await supabase
        .from("businesses")
        .select("id, name, website_url")
        .in("id", businessIds);

    if (businessError) {
      console.error(
        "Business load error:",
        businessError,
      );
    }

    businessMap = new Map(
      ((businessData || []) as BusinessRow[]).map(
        (business) => [
          Number(business.id),
          business,
        ],
      ),
    );
  }

  const rejectedAds: Array<{
    id: string;
    reason: string;
    ad_size: string | number | null;
    image_url: string | null;
  }> = [];

  const ads: MagazineAdLibraryRow[] =
    rawAds.flatMap((row) => {
      const id = String(row.id ?? "").trim();
      const imageUrl = String(
        row.image_url ?? "",
      ).trim();
      const adSize = normalizeAdSize(
        row.ad_size,
      );
      const parsedBusinessId = Number(
        row.business_id,
      );
      const businessId =
        Number.isInteger(parsedBusinessId) &&
        parsedBusinessId > 0
          ? parsedBusinessId
          : 0;

      if (!id) {
        rejectedAds.push({
          id: "(empty)",
          reason: "광고 ID가 없습니다.",
          ad_size: row.ad_size,
          image_url: row.image_url,
        });

        return [];
      }

      if (!imageUrl) {
        rejectedAds.push({
          id,
          reason: "image_url이 비어 있습니다.",
          ad_size: row.ad_size,
          image_url: row.image_url,
        });

        return [];
      }

      if (!adSize) {
        rejectedAds.push({
          id,
          reason: "ad_size를 1~5 값으로 변환할 수 없습니다.",
          ad_size: row.ad_size,
          image_url: row.image_url,
        });

        return [];
      }

      const business =
        businessId > 0
          ? businessMap.get(businessId)
          : undefined;

      const parsedPriority = Number(
        row.priority,
      );
      const parsedAmountPaid = Number(
        row.amount_paid,
      );

      return [
        {
          id,
          business_id: businessId,
          ad_size: adSize,
          image_url: imageUrl,
          enabled: row.enabled !== false,
          priority: Number.isFinite(
            parsedPriority,
          )
            ? parsedPriority
            : 0,
          orientation:
            normalizeOrientation(
              row.orientation,
            ),
          object_fit:
            normalizeObjectFit(
              row.object_fit,
            ),
          click_url:
            row.click_url?.trim() || null,
          ad_title:
            row.ad_title?.trim() || null,
          start_date:
            row.start_date || null,
          end_date:
            row.end_date || null,
          payment_status:
            row.payment_status || null,
          amount_paid:
            row.amount_paid == null
              ? null
              : Number.isFinite(
                    parsedAmountPaid,
                  )
                ? parsedAmountPaid
                : null,
          business_name:
            business?.name?.trim() ||
            row.ad_title?.trim() ||
            `Advertisement ${id}`,
          website_url:
            business?.website_url?.trim() ||
            null,
        },
      ];
    });

  console.info(
    "Magazine advertisement diagnostics:",
    {
      issueId,
      rawAdCount: rawAds.length,
      editorAdCount: ads.length,
      rejectedAdCount:
        rejectedAds.length,
      disabledAdCount:
        rawAds.filter(
          (ad) => ad.enabled === false,
        ).length,
    },
  );

  if (rejectedAds.length > 0) {
    console.warn(
      "Advertisements excluded from editor:",
      rejectedAds,
    );
  }

  return (
    <main className="min-h-screen bg-[#E9E2D8] text-[#172033]">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-[#F8F3EC]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <Link
            href="/admin/community/ads/magazines"
            className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
          >
            ← 잡지 목록
          </Link>

          <div className="min-w-0 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C4483A]">
              KTown Publisher
            </p>

            <h1 className="truncate text-lg font-black">
              {issueData.title}
              {issueData.issue_number
                ? ` · ${issueData.issue_number}`
                : ""}
            </h1>
          </div>

          <span className="rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white">
            {issueData.status === "published"
              ? "발행됨"
              : issueData.status === "archived"
                ? "보관됨"
                : "초안"}
          </span>
        </div>
      </header>

      <MagazineEditor
        issue={
          issueData as MagazineIssueEditorRow
        }
        initialPages={pages}
        initialSlots={slots}
        initialAds={ads}
      />
    </main>
  );
}