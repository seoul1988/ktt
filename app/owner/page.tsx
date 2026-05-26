"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function OwnerPage() {
  const [profile, setProfile] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOwnerData();
  }, []);

  async function loadOwnerData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    if (profileData?.role !== "owner") {
      setLoading(false);
      return;
    }

    const { data: ownerData } = await supabase
      .from("business_owners")
      .select("business_id, businesses(*)")
      .eq("user_id", user.id)
      .eq("status", "approved");

    setBusinesses(ownerData || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-5">로딩중...</div>;
  }

  if (profile?.role !== "owner") {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-8">
        <h1 className="text-2xl font-bold">상점주 권한이 없습니다</h1>
        <p className="mt-3">상점주 신청 후 관리자 승인을 받아야 합니다.</p>

        <a
          href="/owner/request"
          className="mt-5 block rounded-xl bg-black p-3 text-center text-white"
        >
          상점주 신청하기
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold">매장관리</h1>

      {businesses.length === 0 && (
        <p>아직 연결된 매장이 없습니다. 관리자에게 매장 연결을 요청하세요.</p>
      )}

      <div className="space-y-4">
        {businesses.map((item: any) => (
          <div key={item.business_id} className="rounded-2xl bg-white p-4 shadow">
            <h2 className="text-lg font-bold">
              {item.businesses?.name || "이름 없음"}
            </h2>

            <p className="text-sm text-gray-600">
              {item.businesses?.address}
            </p>

            <a
              href={`/owner/business/${item.business_id}`}
              className="mt-4 block rounded-xl bg-black p-3 text-center text-white"
            >
              매장 수정하기
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}