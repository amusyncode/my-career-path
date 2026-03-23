export default function AICenterLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 헤더 */}
      <div>
        <div className="h-8 w-36 bg-gray-200 rounded-lg" />
        <div className="h-4 w-48 bg-gray-200 rounded mt-2" />
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-gray-100"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="h-12 bg-gray-200 rounded-xl" />

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="h-12 bg-gray-100" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-6 py-4 border-b border-gray-50"
          >
            <div className="w-7 h-7 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-14 bg-gray-200 rounded-full" />
            <div className="h-5 w-14 bg-gray-200 rounded-full" />
            <div className="h-5 w-10 bg-gray-200 rounded" />
            <div className="h-5 w-14 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
