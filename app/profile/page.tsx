"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabase";
import ProfileButton from "../components/ProfileButton";
import BottomNav from "../components/BottomNav";

type Profile = {
  id: string;
  email: string | null;
  role: string | null;
  full_name?: string | null;
  phone?: string | null;
  business_name?: string | null;
  owner_status?: string | null;
  requested_business_name?: string | null;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submittingOwner, setSubmittingOwner] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          email,
          role,
          owner_status,
          requested_business_name,
          full_name,
          phone,
          business_name
        `
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        const newProfile: Profile = {
          id: user.id,
          email: user.email || null,
          role: "user",
          owner_status: "none",
          requested_business_name: "",
          full_name: "",
          phone: "",
          business_name: "",
        };

        const { error: createError } = await supabase
          .from("profiles")
          .upsert(newProfile);

        if (createError) {
          alert(createError.message);
          setLoading(false);
          return;
        }

        setProfile(newProfile);
      } else {
        setProfile(data);
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setBusinessName(
          data.business_name || data.requested_business_name || ""
        );
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  function validateProfileSave() {
    if (!fullName.trim()) {
      alert("Please enter your full name.");
      return false;
    }

    return true;
  }

  function validateOwnerApplication() {
    if (!fullName.trim()) {
      alert("Please enter your full name.");
      return false;
    }

    if (!phone.trim()) {
      alert("Please enter your phone number.");
      return false;
    }

    if (!businessName.trim()) {
      alert("Please enter your business name.");
      return false;
    }

    return true;
  }

  async function sendOwnerRequestEmail() {
    if (!profile?.email) return;

    const res = await fetch("/api/send-owner-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: phone.trim(),
        businessName: businessName.trim(),
        email: profile.email,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(
        data?.error || "Failed to send owner request email."
      );
    }
  }

  async function applyOwner() {
    if (!profile) return;
    if (!validateOwnerApplication()) return;

    setSubmittingOwner(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        owner_status: "pending",
        requested_business_name: businessName.trim(),
        business_name: businessName.trim(),
      })
      .eq("id", profile.id);

    if (error) {
      setSubmittingOwner(false);
      alert(error.message);
      return;
    }

    try {
      await sendOwnerRequestEmail();
    } catch (emailError: any) {
      setSubmittingOwner(false);
      alert(
        "Owner request was submitted, but the admin email failed to send: " +
          emailError.message
      );
      return;
    }

    setSubmittingOwner(false);
    alert("Owner request submitted.");
    window.location.href = "/map";
  }

  async function saveProfile() {
    if (!profile) return;

    // Save Profile에서는 이름만 필수 검사합니다.
    // 전화번호와 비즈니스 이름은 비어 있어도 저장됩니다.
    if (!validateProfileSave()) return;

    setSavingProfile(true);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        email: profile.email,
        role: profile.role || "user",
        owner_status: profile.owner_status || "none",
        requested_business_name:
          profile.requested_business_name || "",
        full_name: fullName.trim(),
        phone: phone.trim(),
        business_name: businessName.trim(),
      },
      {
        onConflict: "id",
      }
    );

    setSavingProfile(false);

    if (error) {
      alert(error.message);
      return;
    }

    setProfile({
      ...profile,
      full_name: fullName.trim(),
      phone: phone.trim(),
      business_name: businessName.trim(),
    });

    alert("Profile saved.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FFF8ED] to-[#F5EBDD] text-[#172033]">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-xl">
          <p className="font-black">Loading profile...</p>
        </div>
      </main>
    );
  }

  const isPendingOwner =
    profile?.owner_status === "pending" &&
    profile?.role === "user";

  const isBusy = savingProfile || submittingOwner;

  const roleLabel =
    profile?.role === "admin"
      ? "Administrator"
      : profile?.role === "owner"
        ? "Business Owner"
        : "Community Member";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FFF9EF] via-[#F8F3EC] to-[#EEE4D7] px-4 py-6 pb-32 text-[#172033]">
      <div className="mx-auto max-w-md">
        <header className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/map";
            }}
            className="flex h-11 items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 text-sm font-black shadow-md backdrop-blur transition active:scale-95"
          >
            <span className="text-lg">←</span>
            Back
          </button>

          <ProfileButton />
        </header>

        <section className="overflow-hidden rounded-[30px] border-[7px] border-[#F3EFE8] bg-[#172033] shadow-[0_8px_0_#A8A8A8]">
          <div className="relative px-5 pb-6 pt-8 text-white">
            <div className="absolute -right-7 -top-8 h-32 w-32 rounded-full bg-[#F6C343]/10" />
            <div className="absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-white/5" />

            <div className="relative flex min-w-0 items-center pr-[88px]">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F6C343] text-2xl font-black text-[#172033] shadow-lg">
                {(fullName || profile?.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="ml-4 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F6C343]">
                  My Profile
                </p>
                <h1 className="mt-1 truncate text-[23px] font-black leading-tight">
                  {fullName || "Complete your profile"}
                </h1>
                <p className="mt-1 truncate text-sm text-white/55">
                  {profile?.email}
                </p>
              </div>

              <div className="absolute right-0 top-[-10px] flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white p-1 shadow-xl">
                <Image
                  src="/images/kacc-logo.png"
                  alt="Korean American Chamber of Commerce Raleigh NC"
                  width={76}
                  height={76}
                  priority
                  className="h-full w-full rounded-full object-contain"
                />
              </div>
            </div>

            <div className="relative mt-7 flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Account type
                </p>
                <p className="mt-1 truncate font-black">{roleLabel}</p>
              </div>

              <span className="ml-3 shrink-0 rounded-full bg-[#F6C343] px-4 py-1.5 text-xs font-black text-[#172033]">
                {profile?.role?.toUpperCase() || "USER"}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[32px] border border-white bg-white/90 p-5 shadow-xl backdrop-blur">
          <div className="mb-5">
            <h2 className="text-xl font-black">Account Information</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Save your basic profile anytime. Phone and business name
              are only required when applying as a business owner.
            </p>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-gray-500">
                Email
              </span>
              <div className="flex items-center rounded-2xl border border-gray-100 bg-gray-100 px-4">
                <span className="mr-3 text-lg">✉️</span>
                <input
                  value={profile?.email || ""}
                  disabled
                  className="w-full bg-transparent py-4 text-sm font-bold text-gray-500 outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-gray-500">
                Full Name <span className="text-red-500">*</span>
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                disabled={isPendingOwner}
                className="w-full rounded-2xl border-2 border-gray-100 bg-[#FCFAF7] px-4 py-4 font-bold outline-none transition placeholder:font-medium placeholder:text-gray-300 focus:border-[#F6C343] focus:bg-white disabled:bg-gray-100 disabled:text-gray-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-gray-500">
                <span>Phone</span>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] text-gray-400">
                  Optional
                </span>
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                disabled={isPendingOwner}
                className="w-full rounded-2xl border-2 border-gray-100 bg-[#FCFAF7] px-4 py-4 font-bold outline-none transition placeholder:font-medium placeholder:text-gray-300 focus:border-[#F6C343] focus:bg-white disabled:bg-gray-100 disabled:text-gray-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-gray-500">
                <span>Business Name</span>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] text-gray-400">
                  Optional
                </span>
              </span>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business name"
                disabled={isPendingOwner}
                className="w-full rounded-2xl border-2 border-gray-100 bg-[#FCFAF7] px-4 py-4 font-bold outline-none transition placeholder:font-medium placeholder:text-gray-300 focus:border-[#F6C343] focus:bg-white disabled:bg-gray-100 disabled:text-gray-400"
              />
            </label>
          </div>
        </section>

        {profile?.role === "user" && !isPendingOwner && (
          <section className="mt-5 rounded-[32px] border border-[#F6C343]/40 bg-gradient-to-br from-[#FFF3C9] to-[#FFE59A] p-5 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#172033] text-xl">
                🏪
              </div>
              <div>
                <h2 className="font-black">Own a local business?</h2>
                <p className="mt-1 text-sm leading-5 text-[#5A4A18]">
                  Apply for a business owner account to manage your
                  business listing and promotions.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={applyOwner}
              disabled={isBusy}
              className="w-full rounded-2xl bg-[#C4483A] py-4 font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
            >
              {submittingOwner
                ? "Submitting Application..."
                : "Apply as Business Owner"}
            </button>

            <p className="mt-3 text-center text-xs font-bold text-[#75622D]">
              Phone and business name are required for this application.
            </p>
          </section>
        )}

        {isPendingOwner && (
          <section className="mt-5 rounded-[28px] border border-yellow-200 bg-yellow-50 p-5 shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-400 text-xl">
                ⏳
              </div>
              <div>
                <p className="font-black text-yellow-800">
                  Application under review
                </p>
                <p className="mt-1 text-sm text-yellow-700">
                  Your business owner application is pending approval.
                </p>
              </div>
            </div>
          </section>
        )}

        {profile?.role === "owner" && (
          <a
            href="/owner"
            className="mt-5 block w-full rounded-2xl bg-[#C4483A] py-4 text-center font-black text-white shadow-lg transition active:scale-[0.98]"
          >
            Open My Business Dashboard
          </a>
        )}

        {profile?.role === "admin" && (
          <a
            href="/admin/owner-requests"
            className="mt-5 block w-full rounded-2xl bg-[#172033] py-4 text-center font-black text-white shadow-lg transition active:scale-[0.98]"
          >
            Open Admin Dashboard
          </a>
        )}

        <button
          type="button"
          onClick={saveProfile}
          disabled={isBusy || isPendingOwner}
          className="mt-5 w-full rounded-2xl bg-[#172033] py-4 text-lg font-black text-white shadow-xl transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingProfile ? "Saving Profile..." : "Save Profile"}
        </button>
      </div>

      <nav className="fixed bottom-4 left-0 right-0 z-50 px-4">
       
		<BottomNav activeNav="home" />
      </nav>
    </main>
  );
}