export default function DataLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-40 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-60 bg-gray-200 rounded mb-6" />
      <div className="h-10 w-full bg-gray-200 rounded mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="h-80 bg-gray-200 rounded-xl" />
    </div>
  );
}
