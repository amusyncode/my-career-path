"use client";

import { useState } from "react";
import {
  MoreVertical,
  Edit3,
  CheckCircle2,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type { CounselingRecord, CounselingType } from "@/lib/types";

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

export default function CounselingTimeline({
  records,
  onEdit,
  onToggleComplete,
  onDelete,
}: {
  records: CounselingRecord[];
  onEdit: (record: CounselingRecord) => void;
  onToggleComplete: (record: CounselingRecord) => void;
  onDelete: (record: CounselingRecord) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMenu = (id: string) => {
    setMenuOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        상담 이력
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          총 {records.length}건
        </span>
      </h3>

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          아직 상담 기록이 없습니다.
        </p>
      ) : (
        <div className="relative">
          {records.map((record, index) => {
            const typeConfig = TYPE_CONFIG[record.counseling_type] || TYPE_CONFIG.other;
            const isExpanded = expandedIds.has(record.id);
            const isMenuOpen = menuOpenId === record.id;
            const isLong = (record.content?.length || 0) > 150;

            return (
              <div
                key={record.id}
                className={`relative pl-8 pb-8 ${
                  index < records.length - 1 ? "border-l-2 border-gray-200" : ""
                }`}
                style={{ marginLeft: "7px" }}
              >
                {/* 도트 */}
                <div
                  className={`absolute left-0 top-0 w-4 h-4 rounded-full border-2 border-white ${
                    record.is_completed ? "bg-green-400" : "bg-yellow-400"
                  }`}
                  style={{ marginLeft: "-1px" }}
                />

                {/* 카드 */}
                <div className="bg-gray-50 rounded-xl p-5 ml-4">
                  {/* 헤더 */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-700 text-sm">
                        {formatDate(record.counseling_date)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}
                      >
                        {typeConfig.label}
                      </span>
                      {record.is_completed && (
                        <span className="text-xs text-green-600">완료</span>
                      )}
                    </div>

                    {/* 액션 메뉴 */}
                    <div className="relative">
                      <button
                        onClick={() => toggleMenu(record.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpenId(null)}
                          />
                          <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[140px]">
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                onEdit(record);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              수정
                            </button>
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                onToggleComplete(record);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              {record.is_completed ? (
                                <>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  미완료로 변경
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  완료 처리
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                onDelete(record);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 제목 */}
                  <h4 className="font-medium text-gray-800 mb-2">{record.title}</h4>

                  {/* 내용 */}
                  {record.content && (
                    <div className="mb-3">
                      <p
                        className={`text-sm text-gray-600 whitespace-pre-wrap ${
                          !isExpanded && isLong ? "line-clamp-3" : ""
                        }`}
                      >
                        {record.content}
                      </p>
                      {isLong && (
                        <button
                          onClick={() => toggleExpand(record.id)}
                          className="text-xs text-purple-500 hover:text-purple-700 mt-1 flex items-center gap-0.5"
                        >
                          {isExpanded ? (
                            <>
                              접기 <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              더보기 <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 후속 조치 */}
                  {record.action_items && (
                    <div className="bg-yellow-50 rounded-lg p-3 mb-3">
                      <p className="text-xs font-medium text-yellow-700 mb-1">
                        📌 후속 조치
                      </p>
                      <p className="text-sm text-yellow-800 whitespace-pre-wrap">
                        {record.action_items}
                      </p>
                    </div>
                  )}

                  {/* 다음 상담일 */}
                  {record.next_counseling_date && (
                    <p className="text-xs text-gray-400 mb-2">
                      📅 다음 상담: {formatDate(record.next_counseling_date)}
                    </p>
                  )}

                  {/* AI 제안 있음 표시 */}
                  {record.ai_suggestion && (
                    <div className="flex items-center gap-1 text-xs text-purple-500">
                      <Sparkles className="w-3 h-3" />
                      AI 상담 제안 첨부됨
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
