"use client";

import { useState } from "react";
import { X, School, GraduationCap, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import toast from "react-hot-toast";

interface EditStudentModalProps {
  student: Profile;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditStudentModal({
  student,
  onClose,
  onSuccess,
}: EditStudentModalProps) {
  const supabase = createClient();

  const [educationLevel, setEducationLevel] = useState<"high_school" | "university">(
    student.education_level || "high_school"
  );
  const [name, setName] = useState(student.name || "");
  const [school, setSchool] = useState(student.school || "");
  const [department, setDepartment] = useState(student.department || "");
  const [grade, setGrade] = useState(String(student.grade || ""));
  const [targetField, setTargetField] = useState(student.target_field || "");
  const [studentEmail, setStudentEmail] = useState(student.student_email || "");
  const [phone, setPhone] = useState(student.phone || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [eduChanged, setEduChanged] = useState(false);

  const gradeOptions =
    educationLevel === "high_school" ? [1, 2, 3] : [1, 2, 3, 4];

  const handleSave = async () => {
    if (!name.trim() || !school.trim() || !department.trim() || !grade) {
      toast.error("필수 항목을 모두 입력해주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          school: school.trim(),
          department: department.trim(),
          grade: parseInt(grade),
          target_field: targetField.trim() || null,
          student_email: studentEmail.trim() || null,
          phone: phone.trim() || null,
          education_level: educationLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", student.id);

      if (error) throw error;

      toast.success("학생 정보가 수정되었습니다.");
      onSuccess();
    } catch (err) {
      console.error("학생 수정 실패:", err);
      toast.error("학생 정보 수정에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", student.id);

      if (error) throw error;

      toast.success("학생이 삭제되었습니다.");
      onSuccess();
    } catch (err) {
      console.error("학생 삭제 실패:", err);
      toast.error("학생 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">학생 정보 수정</h2>
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
                  if (educationLevel !== "high_school") setEduChanged(true);
                  if (parseInt(grade) > 3) setGrade("");
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
                  if (educationLevel !== "university") setEduChanged(true);
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
            {eduChanged && (
              <p className="text-xs text-yellow-600 mt-1">
                ⚠️ 학교급을 변경하면 자동 선택되는 AI Gem이 달라질 수 있습니다
              </p>
            )}
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          {showDeleteConfirm ? (
            <div className="bg-red-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700 mb-3">
                이 학생을 삭제하시겠습니까? 학생의 모든 데이터(이력서, 자소서,
                상담기록)가 함께 삭제됩니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      삭제 중...
                    </>
                  ) : (
                    "삭제 확인"
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 text-sm hover:text-red-600 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              학생 삭제
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  "저장"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
