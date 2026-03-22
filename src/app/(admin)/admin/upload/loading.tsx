export default function UploadLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-72 bg-gray-200 rounded mb-6" />
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
        <div className="flex gap-3 mb-4">
          <div className="h-12 w-32 bg-gray-200 rounded-xl" />
          <div className="h-12 w-32 bg-gray-200 rounded-xl" />
        </div>
        <div className="h-40 bg-gray-200 rounded-xl mb-4" />
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded mb-2" />
        ))}
      </div>
    </div>
  );
}
