import { Settings } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">설정</h2>
      <p className="text-gray-500">프로필과 계정 설정을 관리하세요.</p>
    </div>
  );
}
