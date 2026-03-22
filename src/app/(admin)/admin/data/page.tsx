"use client";

import { useState } from "react";
import { Table2, Download, BarChart3, Sparkles } from "lucide-react";
import DataBrowseTab from "./_components/DataBrowseTab";
import DataExportTab from "./_components/DataExportTab";
import DataStatsTab from "./_components/DataStatsTab";
import AIUsageTab from "./_components/AIUsageTab";

const TABS = [
  { id: "browse", label: "데이터 조회", icon: Table2 },
  { id: "export", label: "내보내기", icon: Download },
  { id: "stats", label: "통계 요약", icon: BarChart3 },
  { id: "ai-usage", label: "AI 첨삭 이력", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DataManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>("browse");

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">데이터관리</h1>
        <p className="text-gray-500 text-sm mt-1">
          전체 데이터 조회 및 내보내기
        </p>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "text-purple-600 border-purple-600"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 탭 내용 */}
      {activeTab === "browse" && <DataBrowseTab />}
      {activeTab === "export" && <DataExportTab />}
      {activeTab === "stats" && <DataStatsTab />}
      {activeTab === "ai-usage" && <AIUsageTab />}
    </div>
  );
}
