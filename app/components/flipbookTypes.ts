export type FlipbookAdSize = 1 | 2 | 3 | 4;

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
};

export type AdPage = {
  id: number | string;
  ads: FlipbookAd[];
};


