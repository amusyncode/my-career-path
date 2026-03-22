export default function StudentCounselingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 뒤로가기 */}
      <div className="h-4 w-28 bg-gray-200 rounded" />

      {/* 프로필 카드 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full" />
          <div>
            <div className="h-6 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-40 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="flex gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="h-6 w-10 bg-gray-200 rounded mb-1" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 타임라인 스켈레톤 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="h-6 w-24 bg-gray-200 rounded mb-6" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="pl-8 pb-8 border-l-2 border-gray-200 relative">
            <div className="absolute left-[-9px] top-0 w-4 h-4 bg-gray-200 rounded-full" />
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 bg-gray-200 rounded" />
                  <div className="h-5 w-12 bg-gray-200 rounded-full" />
                </div>
                <div className="h-5 w-5 bg-gray-200 rounded" />
              </div>
              <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-full bg-gray-100 rounded mb-1" />
              <div className="h-3 w-2/3 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
