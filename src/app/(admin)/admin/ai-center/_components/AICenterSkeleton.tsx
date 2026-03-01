"use client";

export default function AICenterSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 헤더 */}
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-72 bg-gray-100 rounded" />
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-200 rounded-xl" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* 탭 바 */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-32 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* 테이블 스켈레톤 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-100 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded flex-1" />
              <div className="h-4 w-12 bg-gray-100 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
