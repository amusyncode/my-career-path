"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import toast from "react-hot-toast";
import {
  LayoutDashboard, UserCog, Users, Sparkles, Settings, LogOut, User, ArrowRight,
} from "lucide-react";

const MENU = [
  { icon: LayoutDashboard, label: "대시보드", href: "/admin/dashboard" },
  { icon: UserCog, label: "강사관리", href: "/admin/instructors" },
  { icon: Users, label: "전체 학생", href: "/admin/students" },
  { icon: Sparkles, label: "Gem 관리", href: "/admin/gems" },
  { icon: Settings, label: "시스템 설정", href: "/admin/settings" },
];

export default function AdminSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃되었습니다.");
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r border-gray-200 z-30">
      <div className="p-6 border-b border-red-100">
        <Link href="/admin/dashboard" className="flex items-center">
          <span className="text-lg font-bold text-red-700">MyCareerPath</span>
          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full ml-2 font-medium">관리자</span>
        </Link>
      </div>
      <nav className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto">
        {MENU.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-red-50 text-red-700 font-medium"
                  : "text-gray-600 hover:bg-red-50 hover:text-red-700"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{profile.name || "관리자"}</p>
            <p className="text-xs text-red-500">플랫폼 관리자</p>
          </div>
          <button onClick={handleSignOut} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="로그아웃">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <Link href="/instructor/dashboard" className="flex items-center gap-2 text-sm text-gray-400 hover:text-purple-600 transition-colors">
          <ArrowRight className="w-4 h-4" />
          강사 뷰로 전환
        </Link>
      </div>
    </aside>
  );
}
