"use client";

import { useState } from "react";
import { X, School, GraduationCap, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface StudentRegistrationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function StudentRegistrationModal({
  onClose,
  onSuccess,
}: StudentRegistrationModalProps) {
  const [educationLevel, setEducationLevel] = useState<"high_school" | "university" | "">("");
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [department, setDepartment] = useState("");
  const [grade, setGrade] = useState("");
  const [targetField, setTargetField] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const gradeOptions =
    educationLevel === "high_school"
      ? [1, 2, 3]
      : educationLevel === "university"
      ? [1, 2, 3, 4]
      : [];

  const handleSubmit = async () => {
    if (!name.trim() || !school.trim() || !department.trim() || !grade || !educationLevel) {
      toast.error("필수 항목을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/instructor/register-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          school: school.trim(),
          department: department.trim(),
          grade,
          target_field: targetField.trim() || null,
          student_email: studentEmail.trim() || null,
          phone: phone.trim() || null,
          education_level: educationLevel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error("이미 등록된 학생입니다.");
        } else {
          toast.error(data.error || "학생 등록에 실패했습니다.");
        }
        return;
      }

      toast.success("학생이 등록되었습니다 ✅");
      onSuccess();
    } catch {
      toast.error("학생 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showBulk) {
    return (
      <BulkStudentRegistration
        onClose={onClose}
        onSuccess={onSuccess}
        onBack={() => setShowBulk(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">학생 등록</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Education Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              학교급 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setEducationLevel("high_school");
                  setGrade("");
                }}
                className={`flex-1 border-2 rounded-xl p-3 cursor-pointer transition-all flex items-center gap-2 ${
                  educationLevel === "high_school"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <School className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium">특성화고</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEducationLevel("university");
                  setGrade("");
                }}
                className={`flex-1 border-2 rounded-xl p-3 cursor-pointer transition-all flex items-center gap-2 ${
                  educationLevel === "university"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium">대학교</span>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="학생 이름"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>

          {/* School */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              학교 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="학교명"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {educationLevel === "university" ? "전공" : "학과"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder={
                educationLevel === "university"
                  ? "전공 (예: 컴퓨터공학)"
                  : "학과 (예: 컴퓨터공학과)"
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              학년 <span className="text-red-500">*</span>
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={!educationLevel}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:opacity-50"
            >
              <option value="">학년 선택</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}학년
                </option>
              ))}
            </select>
          </div>

          {/* Target Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              희망 분야
            </label>
            <input
              type="text"
              value={targetField}
              onChange={(e) => setTargetField(e.target.value)}
              placeholder="희망 취업 분야 (선택)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              학생 이메일
            </label>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="학생 이메일 (AI 첨삭 결과 발송용)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              이메일을 입력하면 AI 첨삭 결과를 학생에게 직접 발송할 수 있습니다
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              연락처
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="연락처 (선택)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowBulk(true)}
              className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
            >
              CSV로 일괄 등록
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    등록 중...
                  </>
                ) : (
                  "등록"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Bulk Student Registration (CSV)
// ============================================

interface BulkProps {
  onClose: () => void;
  onSuccess: () => void;
  onBack: () => void;
}

interface CSVRow {
  name: string;
  school: string;
  department: string;
  education_level: string;
  grade: string;
  target_field: string;
  email: string;
  phone: string;
  status: "valid" | "error" | "duplicate";
  errorMsg?: string;
}

function BulkStudentRegistration({ onClose, onSuccess, onBack }: BulkProps) {
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const handleTemplateDownload = () => {
    const header = "이름,학교,학과,학교급(특성화고/대학교),학년,희망분야,이메일,연락처";
    const example =
      "홍길동,○○특성화고,컴퓨터공학과,특성화고,2,IT개발,gildong@email.com,010-1234-5678";
    const csv = header + "\n" + example;
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "학생등록_템플릿.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const [name, school, department, eduRaw, gradeRaw, target_field, email, phone] = cols;

      const education_level =
        eduRaw === "대학교" ? "university" : "high_school";
      const grade = gradeRaw?.replace(/학년/g, "") || "";

      let status: "valid" | "error" | "duplicate" = "valid";
      let errorMsg = "";

      if (!name || !school || !department || !grade) {
        status = "error";
        errorMsg = "필수값 누락";
      }

      return {
        name,
        school,
        department,
        education_level,
        grade,
        target_field: target_field || "",
        email: email || "",
        phone: phone || "",
        status,
        errorMsg,
      };
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  };

  const validRows = rows.filter((r) => r.status === "valid");

  const handleBulkRegister = async () => {
    if (validRows.length === 0) return;
    setIsRegistering(true);
    setTotal(validRows.length);
    setProgress(0);

    let successCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const res = await fetch("/api/instructor/register-student", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.name,
            school: row.school,
            department: row.department,
            grade: row.grade,
            target_field: row.target_field || null,
            student_email: row.email || null,
            phone: row.phone || null,
            education_level: row.education_level,
          }),
        });

        if (res.ok) successCount++;
      } catch {
        // continue
      }
      setProgress(i + 1);
    }

    toast.success(`${successCount}명의 학생이 등록되었습니다.`);
    setIsRegistering(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ← 개별 등록
            </button>
            <h2 className="text-xl font-bold text-gray-900">CSV 일괄 등록</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <button
              onClick={handleTemplateDownload}
              className="bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              CSV 템플릿 다운로드
            </button>
            <label className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600 transition-colors cursor-pointer">
              파일 선택
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {rows.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-3 py-2">이름</th>
                      <th className="text-left px-3 py-2">학교</th>
                      <th className="text-left px-3 py-2">학과</th>
                      <th className="text-left px-3 py-2">학교급</th>
                      <th className="text-left px-3 py-2">학년</th>
                      <th className="text-left px-3 py-2">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.school}</td>
                        <td className="px-3 py-2">{row.department}</td>
                        <td className="px-3 py-2">
                          {row.education_level === "university"
                            ? "대학교"
                            : "특성화고"}
                        </td>
                        <td className="px-3 py-2">{row.grade}학년</td>
                        <td className="px-3 py-2">
                          {row.status === "valid" && (
                            <span className="text-green-600">✅ 유효</span>
                          )}
                          {row.status === "error" && (
                            <span className="text-red-600">
                              ❌ {row.errorMsg}
                            </span>
                          )}
                          {row.status === "duplicate" && (
                            <span className="text-yellow-600">⚠️ 중복</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isRegistering && (
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                  <p className="text-sm text-purple-700">
                    {progress}/{total}명 등록 중...
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleBulkRegister}
                  disabled={validRows.length === 0 || isRegistering}
                  className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600 disabled:opacity-50 transition-colors"
                >
                  {validRows.length}명 등록
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
