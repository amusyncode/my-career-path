export default function StudentDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back nav skeleton */}
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />

      {/* Profile card skeleton */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />

          {/* Info */}
          <div className="flex-1 space-y-3">
            <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-3 w-64 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <div className="h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Tab bar skeleton */}
      <div className="border-b mb-6">
        <div className="flex gap-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 pb-3">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Content area skeleton */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
