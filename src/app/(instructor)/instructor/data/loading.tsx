export default function DataLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-56 mt-2" />
      </div>
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 h-20" />
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl h-96 border border-gray-100 dark:border-gray-700" />
    </div>
  );
}
