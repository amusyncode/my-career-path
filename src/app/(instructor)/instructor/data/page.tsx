"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Table2, Download, BarChart3, Sparkles, Loader2 } from "lucide-react";
import DataBrowseTab from "@/components/instructor/tabs/DataBrowseTab";
import DataExportTab from "@/components/instructor/tabs/DataExportTab";
import DataStatsTab from "@/components/instructor/tabs/DataStatsTab";
import AIUsageTab from "@/components/instructor/tabs/AIUsageTab";

type TabKey = "browse" | "export" | "stats" | "usage";

const TABS: { key: TabKey; label: string; icon: typeof Table2 }[] = [
  { key: "browse", label: "데이터 조회", icon: Table2 },
  { key: "export", label: "내보내기", icon: Download },
  { key: "stats", label: "통계 요약", icon: BarChart3 },
  { key: "usage", label: "AI 사용 이력", icon: Sparkles },
];

export default function InstructorDataPage() {
  const router = useRouter();
  const supabase = createClient();
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("browse");

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, name")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "instructor" && profile?.role !== "super_admin") {
        router.push("/dashboard");
        return;
      }
      setInstructorId(user.id);
      setInstructorName(profile?.name || "강사");
    };
    check();
  }, [supabase, router]);

  if (!instructorId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">데이터관리</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          내 학생 데이터 조회 및 내보내기
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "browse" && <DataBrowseTab instructorId={instructorId} />}
      {activeTab === "export" && <DataExportTab instructorId={instructorId} instructorName={instructorName} />}
      {activeTab === "stats" && <DataStatsTab instructorId={instructorId} />}
      {activeTab === "usage" && <AIUsageTab instructorId={instructorId} />}
    </div>
  );
}
