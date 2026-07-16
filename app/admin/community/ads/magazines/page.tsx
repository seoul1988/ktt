import { supabase } from "../../../../../lib/supabase";
import MagazineManager from "./MagazineManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type MagazineIssue = {
  id: number;
  title: string;
  issue_number: string | null;
  slug: string | null;
  description: string | null;
  publication_date: string | null;
  cover_image_url: string | null;
  back_cover_image_url: string | null;
  pdf_url: string | null;
  status: "draft" | "published" | "archived";
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export default async function MagazineAdminPage() {
  const { data, error } = await supabase
    .from("magazine_issues")
    .select(`
      id,
      title,
      issue_number,
      slug,
      description,
      publication_date,
      cover_image_url,
      back_cover_image_url,
      pdf_url,
      status,
      is_public,
      published_at,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Magazine issue load error:", error);
  }

  const issues = (data || []) as MagazineIssue[];

  return (
    <MagazineManager
      initialIssues={issues}
      initialError={error?.message || null}
    />
  );
}