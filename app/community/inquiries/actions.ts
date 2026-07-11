"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkAdmin } from "@/lib/checkAdmin";

export async function deleteInquiry(
  formData: FormData,
) {
  const isAdmin = await checkAdmin();

  if (!isAdmin) {
    throw new Error(
      "관리자만 문의를 삭제할 수 있습니다.",
    );
  }

  const id = String(
    formData.get("id") ?? "",
  ).trim();

  if (!id) {
    throw new Error("문의글 ID가 없습니다.");
  }

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("문의 삭제 오류:", error);

    throw new Error(
      `문의 삭제 실패: ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      "문의글이 없거나 삭제하지 못했습니다.",
    );
  }

  revalidatePath("/community/inquiries");
}