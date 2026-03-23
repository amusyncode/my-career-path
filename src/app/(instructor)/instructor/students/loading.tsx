export default function StudentsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-8 w-28 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-6 w-12 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-white rounded-xl shadow-sm p-4 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 h-10 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
          <div className="flex gap-3">
            <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
            <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
            <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
            <div className="h-10 w-28 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden dark:bg-gray-800">
        <div className="bg-gray-50 px-4 py-3 flex gap-4 dark:bg-gray-700">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-600"
              style={{ width: `${60 + Math.random() * 60}px` }}
            />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-4 border-t border-gray-100 flex items-center gap-4 dark:border-gray-700"
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse dark:bg-gray-600" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
              <div className="h-3 w-36 bg-gray-100 rounded animate-pulse dark:bg-gray-700" />
            </div>
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
            <div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse dark:bg-gray-600" />
            <div className="h-4 w-10 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
            <div className="h-4 w-14 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
          </div>
        ))}
      </div>
    </div>
  );
}
