"use client";

import { useState } from "react";
import { X, Copy, Check, Link as LinkIcon } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteCodeModal({ isOpen, onClose }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const inviteCode = process.env.NEXT_PUBLIC_INSTRUCTOR_SIGNUP_CODE || "미설정";
  const signupUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup`
      : "/signup";

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("복사되었습니다.");
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">강사 가입 코드</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Invite Code */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2">
              가입 코드
            </label>
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <span className="flex-1 text-2xl font-mono font-bold text-gray-900 tracking-wider">
                {inviteCode}
              </span>
              <button
                onClick={() => copyToClipboard(inviteCode, "code")}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copiedField === "code" ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              강사가 회원가입 시 이 코드를 입력하면 강사 계정으로 등록됩니다.
            </p>
          </div>

          {/* Signup URL */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2">
              가입 페이지 URL
            </label>
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <LinkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-sm font-mono text-gray-700 truncate">
                {signupUrl}
              </span>
              <button
                onClick={() => copyToClipboard(signupUrl, "url")}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copiedField === "url" ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              코드 변경은 Vercel 환경변수에서 가능합니다. 환경변수 이름:{" "}
              <code className="bg-blue-100 px-1 rounded">
                NEXT_PUBLIC_INSTRUCTOR_SIGNUP_CODE
              </code>
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-red-500 text-white rounded-lg py-3 text-sm font-medium hover:bg-red-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
