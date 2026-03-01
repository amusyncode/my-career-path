"use client";

import Link from "next/link";
import { User, ExternalLink } from "lucide-react";
import type { Profile } from "@/lib/types";

interface CounselingStats {
  totalRecords: number;
  completedRecords: number;
  lastCounselingDate: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function StudentProfileSummary({
  profile,
  stats,
}: {
  profile: Profile;
  stats: CounselingStats;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* 좌측: 프로필 */}
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
              <User className="w-8 h-8 text-purple-400" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
            <p className="text-sm text-gray-500">
              {[profile.school, profile.department, profile.grade ? `${profile.grade}학년` : null]
                .filter(Boolean)
                .join(" | ") || "정보 미입력"}
            </p>
            {profile.target_field && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                {profile.target_field}
              </span>
            )}
          </div>
        </div>

        {/* 우측: 미니 통계 */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
            <p className="text-xs text-gray-500">총 상담</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completedRecords}</p>
            <p className="text-xs text-gray-500">완료</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">
              {stats.totalRecords - stats.completedRecords}
            </p>
            <p className="text-xs text-gray-500">미완료</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              {stats.lastCounselingDate ? formatDate(stats.lastCounselingDate) : "-"}
            </p>
            <p className="text-xs text-gray-500">최근 상담</p>
          </div>
        </div>
      </div>

      {/* 학생 상세 보기 링크 */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <Link
          href={`/admin/students/${profile.id}`}
          className="text-sm text-gray-400 hover:text-purple-600 flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          학생 상세 보기
        </Link>
      </div>
    </div>
  );
}
