"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { X, Eye, EyeOff, Copy, Check, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreatedResult {
  email: string;
  password: string;
  invite_code: string;
}

const generatePassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const all = upper + lower + digits + special;
  let pw =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 12; i++)
    pw += all[Math.floor(Math.random() * all.length)];
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

export default function CreateInstructorModal({
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailChecking, setEmailChecking] = useState(false);
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce email duplicate check
  useEffect(() => {
    if (!email || !email.includes("@")) {
      setEmailError("");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (data) {
          setEmailError("이미 등록된 이메일입니다.");
        } else {
          setEmailError("");
        }
      } catch {
        // ignore
      }
      setEmailChecking(false);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [email, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailError) return;
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/create-instructor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, school, phone }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");

      setResult({
        email,
        password,
        invite_code: data.invite_code || "",
      });
      toast.success("강사 계정이 생성되었습니다.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "강사 생성에 실패했습니다.";
      toast.error(message);
    }
    setIsSubmitting(false);
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("복사되었습니다.");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAll = async () => {
    if (!result) return;
    const text = `이메일: ${result.email}\n비밀번호: ${result.password}${result.invite_code ? `\n초대 코드: ${result.invite_code}` : ""}`;
    await navigator.clipboard.writeText(text);
    setCopiedField("all");
    toast.success("전체 정보가 복사되었습니다.");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleClose = () => {
    if (result) {
      onSuccess();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">강사 계정 생성</h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {!result ? (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="instructor@example.com"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                  emailError
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200"
                }`}
              />
              {emailChecking && (
                <p className="text-xs text-gray-400 mt-1">확인 중...</p>
              )}
              {emailError && (
                <p className="text-xs text-red-500 mt-1">{emailError}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6자 이상"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generatePassword());
                    setShowPassword(true);
                  }}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  자동 생성
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* School */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                소속
              </label>
              <input
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="학교/기관명"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연락처
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !!emailError || emailChecking}
              className="w-full bg-red-500 text-white rounded-lg py-3 text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "생성 중..." : "강사 계정 생성"}
            </button>
          </form>
        ) : (
          /* Result panel */
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-green-800">
                계정이 생성되었습니다
              </h4>

              <div className="space-y-2">
                <div>
                  <span className="text-xs text-green-600 font-medium">
                    이메일
                  </span>
                  <p className="text-sm text-green-900 font-mono">
                    {result.email}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-green-600 font-medium">
                      비밀번호
                    </span>
                    <p className="text-sm text-green-900 font-mono">
                      {result.password}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(result.password, "password")
                    }
                    className="p-1.5 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    {copiedField === "password" ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-green-600" />
                    )}
                  </button>
                </div>

                {result.invite_code && (
                  <div>
                    <span className="text-xs text-green-600 font-medium">
                      초대 코드
                    </span>
                    <p className="text-sm text-green-900 font-mono">
                      {result.invite_code}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                &#9888; 이 정보를 강사에게 전달하세요. 비밀번호는 다시 확인할 수
                없습니다.
              </p>
            </div>

            <button
              onClick={copyAll}
              className="w-full bg-white border border-gray-200 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              {copiedField === "all" ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              전체 복사
            </button>

            <button
              onClick={handleClose}
              className="w-full bg-red-500 text-white rounded-lg py-3 text-sm font-medium hover:bg-red-600 transition-colors"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
