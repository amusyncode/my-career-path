export default function AdminDashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* 인사 섹션 */}
      <div>
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-2">
                <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 차트 2개 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="h-56 bg-gray-100 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* 최근 가입 학생 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>

      {/* AI 첨삭 현황 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="flex gap-4 mb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>

      {/* 다가오는 상담 일정 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
