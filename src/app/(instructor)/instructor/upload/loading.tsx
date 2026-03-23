export default function UploadLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="h-7 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-80 bg-gray-100 rounded" />
        </div>
        <div className="h-6 w-28 bg-purple-100 rounded-full" />
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
        <div className="flex gap-3 mb-4">
          <div className="h-16 w-40 bg-gray-100 rounded-xl" />
          <div className="h-16 w-40 bg-gray-100 rounded-xl" />
        </div>
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-10">
          <div className="h-12 w-12 bg-gray-100 rounded-full mx-auto mb-3" />
          <div className="h-4 w-56 bg-gray-100 rounded mx-auto mb-2" />
          <div className="h-3 w-72 bg-gray-50 rounded mx-auto" />
        </div>
      </div>

      {/* Recent uploads */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex justify-between items-center py-3 border-b"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-gray-100 rounded" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
              <div className="h-4 w-14 bg-gray-50 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-12 bg-gray-100 rounded" />
              <div className="h-4 w-16 bg-gray-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
