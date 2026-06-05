"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import BottomNav from "../../components/BottomNav";
type Business = {
  id: number;
  name: string;
};

type Coupon = {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  coupon_type: string;
  value: number;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number;
  used_count: number;
  active: boolean;
  pin_code?: string | null;
};

export default function NewCouponPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [businessId, setBusinessId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [couponType, setCouponType] = useState("percent");
  const [value, setValue] = useState(10);
  const [usageLimit, setUsageLimit] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
const [pinCode, setPinCode] = useState("");


  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (businessId) {
      loadCoupons(businessId);
    }
  }, [businessId]);

  async function loadBusinesses() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("businesses")
      .select("id,name")
      .eq("owner_id", user.id)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setBusinesses(data || []);

    if (data?.length) {
      setBusinessId(String(data[0].id));
    }
  }

  async function loadCoupons(selectedBusinessId: string) {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("business_id", selectedBusinessId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setCoupons(data || []);
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCouponType("percent");
    setValue(10);
    setUsageLimit(1);
    setStartDate("");
    setEndDate("");
	setPinCode("");
  }

  function getIsExpired(coupon: Coupon) {
    const dateExpired =
      coupon.end_date && new Date(coupon.end_date) < new Date();

    const quantityExpired =
      coupon.usage_limit > 0 &&
      coupon.used_count >= coupon.usage_limit;

    return Boolean(dateExpired || quantityExpired || !coupon.active);
  }

  async function saveCoupon() {
    if (!businessId) {
      alert("상점을 선택하세요.");
      return;
    }

    if (!title.trim()) {
      alert("쿠폰 제목을 입력하세요.");
      return;
    }
	if (pinCode.length !== 4) {
	  alert("4자리 PIN을 입력하세요.");
	  return;
	}
		const payload = {
      business_id: Number(businessId),
      title,
      description,
      coupon_type: couponType,
      value,
      usage_limit: usageLimit,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      active: true,
	  pin_code: pinCode,
    };

    if (editingId) {
      const { error } = await supabase
        .from("coupons")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        return;
      }

      alert("쿠폰 수정 완료");
    } else {
      const { error } = await supabase
        .from("coupons")
        .insert(payload);

      if (error) {
        alert(error.message);
        return;
      }

      alert("쿠폰 등록 완료");
    }

    resetForm();
    loadCoupons(businessId);
  }

  function editCoupon(coupon: Coupon) {
    setEditingId(coupon.id);
    setBusinessId(String(coupon.business_id));
    setTitle(coupon.title);
    setDescription(coupon.description || "");
    setCouponType(coupon.coupon_type);
    setValue(Number(coupon.value || 0));
    setUsageLimit(Number(coupon.usage_limit || 1));
    setStartDate(coupon.start_date ? coupon.start_date.slice(0, 16) : "");
    setEndDate(coupon.end_date ? coupon.end_date.slice(0, 16) : "");
	setPinCode(coupon.pin_code || "");
  }

  async function deleteCoupon(id: number) {
    if (!confirm("이 쿠폰을 삭제할까요?")) return;

    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("쿠폰 삭제 완료");
    loadCoupons(businessId);
  }

  async function toggleActive(coupon: Coupon) {
    const { error } = await supabase
      .from("coupons")
      .update({
        active: !coupon.active,
      })
      .eq("id", coupon.id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCoupons(businessId);
  }

 return (

<main className="min-h-screen bg-[#F8F3EC] px-5 pb-28 pt-5 text-[#172033]">

<div
className="
max-w-md
mx-auto
"
>
      <div className="mb-6 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <button
      onClick={() => {
        window.location.href = "/map";
      }}
      className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
    >
      ← Back
    </button>

    <h1 className="text-3xl font-black">
      Register Coupon
    </h1>
  </div>

  <ProfileButton />
</div>

      <select
        value={businessId}
        onChange={(e) => setBusinessId(e.target.value)}
        className="mb-3 w-full rounded border p-3"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <div className="mb-6 rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-bold">
          {editingId ? "쿠폰 수정" : "쿠폰 등록"}
        </h2>

        <input
          placeholder="Title 예: 첫 방문 10% 할인"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-3 w-full rounded border p-3"
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-3 w-full rounded border p-3"
        />

        <select
          value={couponType}
          onChange={(e) => setCouponType(e.target.value)}
          className="mb-3 w-full rounded border p-3"
        >
          <option value="percent">Percent</option>
          <option value="fixed">Amount</option>
          <option value="free">Free</option>
        </select>

        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          placeholder="할인 값"
          className="mb-3 w-full rounded border p-3"
        />

    <div className="mb-3">
		  <label className="mb-1 block text-sm font-bold">
			쿠폰 수량
		  </label>

		  <input
			type="number"
			value={usageLimit}
			onChange={(e) => setUsageLimit(Number(e.target.value))}
			placeholder="예: 100"
			className="w-full rounded border p-3"
		  />

		  <p className="mt-1 text-xs text-gray-500">
			수량이 모두 사용되면 자동 종료됩니다.
		  </p>
		</div>

        <label className="mb-1 block text-sm font-bold">
          시작일
        </label>
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mb-3 w-full rounded border p-3"
        />

        <label className="mb-1 block text-sm font-bold">
          종료일
        </label>
        <input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="mb-4 w-full rounded border p-3"
        />
		<label className="mb-1 block text-sm font-bold">
		  4-Digit PIN
		</label>

		<input
		  type="text"
		  maxLength={4}
		  value={pinCode}
		  onChange={(e) =>
			setPinCode(e.target.value.replace(/\D/g, "").slice(0, 4))
		  }
		  placeholder="예: 1234"
		  className="mb-4 w-full rounded border p-3"
		/>
		
		

        <button
          onClick={saveCoupon}
          className="w-full rounded bg-red-500 p-3 font-bold text-white"
        >
          {editingId ? "수정하기" : "등록하기"}
        </button>

        {editingId && (
          <button
            onClick={resetForm}
            className="mt-2 w-full rounded bg-gray-200 p-3 font-bold"
          >
            수정 취소
          </button>
        )}
      </div>

      <h2 className="mb-3 text-xl font-bold">
        등록된 쿠폰
      </h2>

      <div className="space-y-3">
        {coupons.map((coupon) => {
          const expired = getIsExpired(coupon);

          return (
            <div
              key={coupon.id}
              className="rounded-2xl border bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{coupon.title}</p>
                  <p className="text-sm text-gray-500">
                    {coupon.description}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    expired
                      ? "bg-gray-200 text-gray-600"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {expired ? "Expired" : "Active"}
                </span>
              </div>

              <p className="mt-2 text-sm">
                사용: {coupon.used_count || 0} / {coupon.usage_limit || 0}
              </p>

              <p className="text-sm text-gray-500">
                기간:{" "}
                {coupon.start_date
                  ? new Date(coupon.start_date).toLocaleDateString()
                  : "No start"}{" "}
                ~{" "}
                {coupon.end_date
                  ? new Date(coupon.end_date).toLocaleDateString()
                  : "No end"}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => editCoupon(coupon)}
                  className="flex-1 rounded bg-blue-500 p-2 text-sm font-bold text-white"
                >
                  수정
                </button>

                <button
                  onClick={() => toggleActive(coupon)}
                  className="flex-1 rounded bg-gray-700 p-2 text-sm font-bold text-white"
                >
                  {coupon.active ? "비활성" : "활성"}
                </button>

                <button
                  onClick={() => deleteCoupon(coupon.id)}
                  className="flex-1 rounded bg-red-500 p-2 text-sm font-bold text-white"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
   </div>

  <BottomNav />

</main>

);
}