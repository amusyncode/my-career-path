"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/lib/types";
import { LayoutDashboard, UserCog, Users, Sparkles, Settings } from "lucide-react";

const TABS = [
  { icon: LayoutDashboard, label: "대시보드", href: "/admin/dashboard" },
  { icon: UserCog, label: "강사", href: "/admin/instructors" },
  { icon: Users, label: "학생", href: "/admin/students" },
  { icon: Sparkles, label: "Gem", href: "/admin/gems" },
  { icon: Settings, label: "설정", href: "/admin/settings" },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AdminMobileNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-30 flex items-center justify-around px-2">
      {TABS.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 ${
              isActive ? "text-red-600" : "text-gray-400"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
