export default function CounselingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <div className="h-7 w-40 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* 통계 카드 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
            <div className="h-7 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* 필터바 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-3">
          <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* 상담 카드 5개 */}
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 bg-gray-200 rounded" />
                <div className="h-5 w-12 bg-gray-200 rounded-full" />
              </div>
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
            <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-full bg-gray-100 rounded mb-1" />
            <div className="h-3 w-3/4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
