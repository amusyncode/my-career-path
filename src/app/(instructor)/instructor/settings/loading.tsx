export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-20 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-40 bg-gray-100 rounded" />
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-6">
          <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-10 bg-gray-100 rounded-lg" />
            <div className="h-10 bg-gray-100 rounded-lg" />
            <div className="h-10 bg-gray-50 rounded-lg w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
