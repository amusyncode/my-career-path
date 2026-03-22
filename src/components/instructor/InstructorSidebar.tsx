"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import {
  LayoutDashboard,
  Users,
  BrainCircuit,
  MessageSquareHeart,
  Database,
  FileUp,
  Settings,
  LogOut,
  ArrowLeftRight,
} from "lucide-react";
import toast from "react-hot-toast";

const MENU_ITEMS = [
  { icon: LayoutDashboard, label: "대시보드", href: "/instructor/dashboard" },
  { icon: Users, label: "학생관리", href: "/instructor/students" },
  { icon: BrainCircuit, label: "AI 분석센터", href: "/instructor/ai-center" },
  { icon: MessageSquareHeart, label: "개별상담도우미", href: "/instructor/counseling" },
  { icon: Database, label: "데이터관리", href: "/instructor/data" },
  { icon: FileUp, label: "이력서 일괄업로드", href: "/instructor/upload" },
  { icon: Settings, label: "설정", href: "/instructor/settings" },
];

interface InstructorSidebarProps {
  profile: Profile;
}

export default function InstructorSidebar({ profile }: InstructorSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃되었습니다.");
    router.push("/login");
    router.refresh();
  };

  const initials = profile.name?.charAt(0) || "?";

  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-30">
      {/* 로고 */}
      <div className="h-16 flex items-center px-6 border-b border-purple-100 dark:border-gray-700">
        <Link href="/instructor/dashboard" className="text-lg font-bold text-purple-700 dark:text-purple-400">
          MyCareerPath
        </Link>
        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
          profile.role === "super_admin"
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
        }`}>
          {profile.role === "super_admin" ? "관리자" : "강사"}
        </span>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/instructor/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-purple-50 text-purple-700 font-medium dark:bg-purple-900/20 dark:text-purple-400"
                  : "text-gray-600 hover:bg-purple-50 hover:text-purple-700 dark:text-gray-400 dark:hover:bg-purple-900/10 dark:hover:text-purple-400"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 프로필 */}
      <div className="mt-auto border-t border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="프로필"
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {profile.name}
            </p>
            <p className="text-xs text-gray-400">강사</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            학생 뷰로 전환
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-400 hover:text-red-500 rounded transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>
    </aside>
  );
}
