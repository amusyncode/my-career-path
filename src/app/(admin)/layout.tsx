"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import {
  Users,
  MessageSquare,
  Sparkles,
  LogOut,
  Bell,
  MoreHorizontal,
  X,
  User,
  Shield,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const ADMIN_MENU_ITEMS = [
  { icon: Users, label: "학생관리", href: "/admin/students" },
  { icon: MessageSquare, label: "개별상담도우미", href: "/admin/counseling" },
  { icon: Sparkles, label: "AI 분석센터", href: "/admin/ai-center" },
];

const ADMIN_MOBILE_TABS = ADMIN_MENU_ITEMS;

const ADMIN_PAGE_TITLES: Record<string, string> = {
  "/admin/students": "학생관리",
  "/admin/counseling": "개별상담도우미",
  "/admin/ai-center": "AI 분석센터",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      const p = data as Profile;
      if (p.role !== "admin") {
        toast.error("관리자 권한이 필요합니다.");
        router.push("/dashboard");
        return;
      }
      setProfile(p);
    }
    setIsLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃되었습니다.");
    router.push("/login");
    router.refresh();
  };

  const currentTitle =
    Object.entries(ADMIN_PAGE_TITLES).find(([key]) =>
      pathname.startsWith(key)
    )?.[1] || "관리자";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!profile || profile.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== 데스크톱 사이드바 ========== */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r border-gray-200 z-30">
        {/* 로고 */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Link
            href="/admin/students"
            className="flex items-center gap-2 text-xl font-bold text-purple-600"
          >
            MyCareerPath
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </Link>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {ADMIN_MENU_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-purple-50 text-purple-600 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}

          {/* 학생 대시보드 이동 링크 */}
          <div className="pt-4 mt-4 border-t border-gray-100">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              학생용 대시보드
            </Link>
          </div>
        </nav>

        {/* 프로필 미니카드 */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="프로필"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.name || "관리자"}
              </p>
              <p className="text-xs text-purple-500 truncate">관리자</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========== 메인 영역 ========== */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* 상단 헤더 */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-gray-900">
            {currentTitle}
          </h1>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="프로필"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-purple-600" />
              )}
            </div>
          </div>
        </header>

        {/* 콘텐츠 */}
        <main className="flex-1 p-6 pb-24 md:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ========== 모바일 하단 탭 ========== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-30 flex items-center justify-around px-2">
        {ADMIN_MOBILE_TABS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
                isActive ? "text-purple-600" : "text-gray-400"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-gray-400"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium">더보기</span>
        </button>
      </nav>

      {/* ========== 더보기 시트 ========== */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="text-base font-semibold text-gray-900">
                더보기
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 py-3 space-y-1 pb-8">
              <Link
                href="/dashboard"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                <Shield className="w-5 h-5" />
                학생용 대시보드
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-500 hover:bg-red-50 w-full transition-colors"
              >
                <LogOut className="w-5 h-5" />
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
