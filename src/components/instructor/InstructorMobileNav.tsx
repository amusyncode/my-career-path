"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import {
  LayoutDashboard,
  Users,
  BrainCircuit,
  MessageSquareHeart,
  Menu,
  Database,
  FileUp,
  Settings,
  LogOut,
  ArrowLeftRight,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const TABS = [
  { icon: LayoutDashboard, label: "대시보드", href: "/instructor/dashboard" },
  { icon: Users, label: "학생", href: "/instructor/students" },
  { icon: BrainCircuit, label: "AI", href: "/instructor/ai-center" },
  { icon: MessageSquareHeart, label: "상담", href: "/instructor/counseling" },
];

const MORE_ITEMS = [
  { icon: Database, label: "데이터관리", href: "/instructor/data" },
  { icon: FileUp, label: "이력서 업로드", href: "/instructor/upload" },
  { icon: Settings, label: "설정", href: "/instructor/settings" },
];

const PAGE_TITLES: Record<string, string> = {
  "/instructor/dashboard": "대시보드",
  "/instructor/students": "학생관리",
  "/instructor/ai-center": "AI 분석센터",
  "/instructor/counseling": "개별상담도우미",
  "/instructor/data": "데이터관리",
  "/instructor/upload": "이력서 업로드",
  "/instructor/settings": "설정",
};

interface InstructorMobileNavProps {
  profile: Profile;
}

export default function InstructorMobileNav({ profile }: InstructorMobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃되었습니다.");
    router.push("/login");
    router.refresh();
  };

  const currentTitle = PAGE_TITLES[pathname] || "강사";
  const initials = profile.name?.charAt(0) || "?";

  return (
    <>
      {/* 상단 헤더 */}
      <header className="md:hidden sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-50 h-14 flex items-center justify-between px-4">
        <Link href="/instructor/dashboard" className="text-purple-700 dark:text-purple-400 font-bold text-sm">
          MyCareerPath
        </Link>
        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
          {currentTitle}
        </span>
        <div className="w-8 h-8 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
      </header>

      {/* 하단 탭 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-50 flex items-center justify-around px-2">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 text-xs ${
                isActive
                  ? "text-purple-600 dark:text-purple-400 font-medium"
                  : "text-gray-400"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 text-xs ${
            MORE_ITEMS.some((m) => pathname.startsWith(m.href))
              ? "text-purple-600 dark:text-purple-400 font-medium"
              : "text-gray-400"
          }`}
        >
          <Menu className="w-5 h-5" />
          <span>더보기</span>
        </button>
      </nav>

      {/* 바텀시트 */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-[60]"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-lg z-[70] animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">더보기</span>
              <button onClick={() => setMoreOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-2 pb-8">
              {MORE_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      isActive ? "text-purple-700 dark:text-purple-400 font-medium" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
              <hr className="border-gray-100 dark:border-gray-700 my-2" />
              <Link
                href="/dashboard"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-6 py-3.5 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ArrowLeftRight className="w-5 h-5" />
                학생 뷰로 전환
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-6 py-3.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 w-full transition-colors"
              >
                <LogOut className="w-5 h-5" />
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
