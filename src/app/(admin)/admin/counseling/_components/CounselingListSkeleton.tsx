"use client";

export default function CounselingListSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <div className="h-7 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-56 bg-gray-200 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* 통계 카드 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-gray-200 rounded-lg" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* 카드 리스트 */}
      <div className="bg-white rounded-xl shadow-sm">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 border-b border-gray-100 last:border-0">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 bg-gray-200 rounded" />
                <div className="h-5 w-12 bg-gray-200 rounded-full" />
              </div>
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
            <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-full bg-gray-200 rounded mb-1" />
            <div className="h-3 w-2/3 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
