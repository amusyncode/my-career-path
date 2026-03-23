export default function StudentDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />

      {/* Profile card skeleton */}
      <div className="bg-white rounded-xl shadow-sm p-6 dark:bg-gray-800">
        <div className="flex gap-6">
          <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <div className="h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm p-4 dark:bg-gray-800"
          >
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-4 border-b pb-3 dark:border-gray-700">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-20 bg-gray-200 rounded animate-pulse"
          />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-6 animate-pulse dark:bg-gray-800"
          >
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="space-y-3">
              <div className="h-14 bg-gray-100 rounded" />
              <div className="h-14 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
