"use client";

import type { CounselingRecordWithStudent, CounselingType } from "@/lib/types";

const TYPE_CONFIG: Record<CounselingType, { label: string; color: string }> = {
  career: { label: "진로", color: "bg-purple-100 text-purple-700" },
  resume: { label: "이력서", color: "bg-blue-100 text-blue-700" },
  interview: { label: "면접", color: "bg-green-100 text-green-700" },
  mental: { label: "고충", color: "bg-orange-100 text-orange-700" },
  other: { label: "기타", color: "bg-gray-100 text-gray-700" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function CounselingRecordCard({
  record,
  onClick,
}: {
  record: CounselingRecordWithStudent;
  onClick: (record: CounselingRecordWithStudent) => void;
}) {
  const typeConfig = TYPE_CONFIG[record.counseling_type] || TYPE_CONFIG.other;

  return (
    <div
      onClick={() => onClick(record)}
      className="p-5 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition"
    >
      {/* 상단 행 */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">
            {record.profiles?.name || "이름없음"}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}
          >
            {typeConfig.label}
          </span>
          {record.is_completed ? (
            <span className="text-green-500 text-sm">✅</span>
          ) : (
            <span className="text-yellow-500 text-sm">⏳</span>
          )}
        </div>
        <span className="text-sm text-gray-400">
          {formatDate(record.counseling_date)}
        </span>
      </div>

      {/* 중단 */}
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-800">{record.title}</p>
        {record.content && (
          <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
            {record.content}
          </p>
        )}
      </div>

      {/* 하단 */}
      <div className="mt-2 flex gap-2 flex-wrap">
        {record.action_items && (
          <span className="bg-yellow-50 text-yellow-600 text-xs px-2 py-0.5 rounded">
            후속조치 있음
          </span>
        )}
        {record.next_counseling_date && (
          <span className="text-xs text-gray-400">
            다음 상담: {formatDate(record.next_counseling_date)}
          </span>
        )}
        {record.ai_suggestion && (
          <span className="bg-purple-50 text-purple-600 text-xs px-2 py-0.5 rounded">
            AI 제안 포함
          </span>
        )}
      </div>
    </div>
  );
}
