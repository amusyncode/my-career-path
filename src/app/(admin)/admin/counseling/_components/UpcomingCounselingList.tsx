"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import type { CounselingRecordWithStudent, CounselingType } from "@/lib/types";

const TYPE_LABEL: Record<CounselingType, string> = {
  career: "진로",
  resume: "이력서",
  interview: "면접",
  mental: "고충",
  other: "기타",
};

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getDDay(dateStr: string) {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function UpcomingCounselingList({
  items,
}: {
  items: CounselingRecordWithStudent[];
}) {
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
      <h3 className="font-semibold text-purple-800 flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4" />
        다가오는 상담 일정
      </h3>
      <div className="space-y-0">
        {items.slice(0, 5).map((item) => {
          const dDay = getDDay(item.next_counseling_date!);
          return (
            <div
              key={item.id}
              onClick={() => router.push(`/admin/counseling/${item.user_id}`)}
              className="flex justify-between items-center py-2 border-b border-purple-100 last:border-0 cursor-pointer hover:bg-purple-100/50 rounded px-2 -mx-2 transition"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-purple-700 text-sm min-w-[40px]">
                  {formatShortDate(item.next_counseling_date!)}
                </span>
                <span className="text-sm text-gray-800">
                  {item.profiles?.name || "이름없음"}
                </span>
                <span className="text-xs px-1.5 py-0.5 bg-purple-200/50 text-purple-700 rounded">
                  {TYPE_LABEL[item.counseling_type] || "기타"}
                </span>
                <span className="text-xs text-gray-500 truncate max-w-[200px]">
                  {item.title}
                </span>
              </div>
              <span className="bg-purple-200 text-purple-800 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap">
                D-{dDay}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
