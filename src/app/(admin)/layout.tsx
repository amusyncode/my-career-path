"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import { Bell, User } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/admin/dashboard": "관리자 대시보드",
  "/admin/instructors": "강사관리",
  "/admin/students": "전체 학생 관리",
  "/admin/gems": "Gem 관리",
  "/admin/settings": "시스템 설정",
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      const p = data as Profile;
      if (p.role === "student") { router.push("/dashboard"); return; }
      if (p.role === "instructor") { router.push("/instructor/dashboard"); return; }
      if (p.role !== "super_admin") { router.push("/dashboard"); return; }
      setProfile(p);
    }
    setIsLoading(false);
  }, [supabase, router]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const currentTitle = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] || "관리자";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!profile || profile.role !== "super_admin") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar profile={profile} />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-gray-900">{currentTitle}</h1>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-red-600" />
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 pb-24 md:pb-6 overflow-y-auto">{children}</main>
      </div>
      <AdminMobileNav profile={profile} />
    </div>
  );
}
