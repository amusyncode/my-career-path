"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import {
  LayoutDashboard,
  Map,
  CalendarCheck,
  FolderOpen,
  Award,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  MoreHorizontal,
  X,
  User,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const MENU_ITEMS = [
  { icon: LayoutDashboard, label: "대시보드", href: "/dashboard" },
  { icon: Map, label: "로드맵", href: "/roadmap" },
  { icon: CalendarCheck, label: "일일기록", href: "/daily" },
  { icon: FolderOpen, label: "포트폴리오", href: "/portfolio" },
  { icon: Award, label: "자격증", href: "/certificates" },
  { icon: FileText, label: "이력서", href: "/resume" },
  { icon: BarChart3, label: "분석", href: "/analytics" },
  { icon: Settings, label: "설정", href: "/profile" },
];

const MOBILE_TABS = MENU_ITEMS.slice(0, 4);

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "대시보드",
  "/roadmap": "로드맵",
  "/daily": "일일기록",
  "/portfolio": "포트폴리오",
  "/certificates": "자격증",
  "/resume": "이력서",
  "/analytics": "분석",
  "/profile": "설정",
};

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) setProfile(data as Profile);
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃되었습니다.");
    router.push("/login");
    router.refresh();
  };

  const currentTitle = PAGE_TITLES[pathname] || "대시보드";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== 데스크톱 사이드바 ========== */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r border-gray-200 z-30">
        {/* 로고 */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Link href="/dashboard" className="text-xl font-bold text-primary">
            MyCareerPath
          </Link>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 프로필 미니카드 */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="프로필"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.name || "사용자"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {profile?.department || "학과 미설정"}
              </p>
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
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="프로필"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-primary" />
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
        {MOBILE_TABS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
                isActive ? "text-blue-600" : "text-gray-400"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        {/* 더보기 */}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
            MENU_ITEMS.slice(4).some((m) => pathname === m.href)
              ? "text-blue-600"
              : "text-gray-400"
          }`}
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
              {MENU_ITEMS.slice(4).map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-600 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
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
