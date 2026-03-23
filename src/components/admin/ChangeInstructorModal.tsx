"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { X, Search, Loader2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface InstructorOption {
  id: string;
  name: string;
  school: string | null;
  studentCount: number;
}

interface ChangeInstructorModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  currentInstructorId: string | null;
  onSuccess: () => void;
}

export default function ChangeInstructorModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  currentInstructorId,
  onSuccess,
}: ChangeInstructorModalProps) {
  const supabase = createClient();
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentInstructorName, setCurrentInstructorName] = useState<string>("-");

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    // Fetch all active instructors
    const { data: instrData } = await supabase
      .from("profiles")
      .select("id, name, school")
      .eq("role", "instructor")
      .eq("is_active", true)
      .order("name");

    if (!instrData) {
      setLoading(false);
      return;
    }

    // Fetch student counts per instructor
    const { data: students } = await supabase
      .from("profiles")
      .select("instructor_id")
      .eq("role", "student");

    const countMap = new Map<string, number>();
    students?.forEach((s) => {
      if (s.instructor_id) {
        countMap.set(s.instructor_id, (countMap.get(s.instructor_id) ?? 0) + 1);
      }
    });

    const options: InstructorOption[] = instrData.map((i) => ({
      id: i.id,
      name: i.name,
      school: i.school,
      studentCount: countMap.get(i.id) ?? 0,
    }));

    setInstructors(options);

    // Current instructor name
    if (currentInstructorId) {
      const current = instrData.find((i) => i.id === currentInstructorId);
      if (current) setCurrentInstructorName(current.name);
    }

    setLoading(false);
  }, [supabase, currentInstructorId]);

  useEffect(() => {
    if (isOpen) {
      fetchInstructors();
      setSelectedId(null);
      setSearchQuery("");
    }
  }, [isOpen, fetchInstructors]);

  const filteredInstructors = instructors.filter((i) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      (i.school && i.school.toLowerCase().includes(q))
    );
  });

  const handleChange = async () => {
    if (!selectedId) {
      toast.error("변경할 강사를 선택해주세요.");
      return;
    }
    if (selectedId === currentInstructorId) {
      toast.error("현재 담당 강사와 동일합니다.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/update-student", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          updates: { instructor_id: selectedId },
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("담당 강사가 변경되었습니다.");
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || "변경 실패");
      }
    } catch {
      toast.error("담당 강사 변경 중 오류가 발생했습니다.");
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">담당 강사 변경</h2>
            <p className="text-sm text-gray-500 mt-0.5">{studentName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Current instructor */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">현재 담당 강사</p>
            <p className="font-medium text-gray-900">
              {currentInstructorId ? currentInstructorName : "미배정"}
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              담당 강사를 변경하면 기존 강사는 이 학생의 데이터에 접근할 수 없게 됩니다.
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="강사 이름 또는 학교로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Instructor list */}
          <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : filteredInstructors.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                조건에 맞는 강사가 없습니다.
              </div>
            ) : (
              filteredInstructors.map((instr) => (
                <button
                  key={instr.id}
                  onClick={() => setSelectedId(instr.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedId === instr.id ? "bg-red-50 border-l-4 border-l-red-500" : ""
                  } ${instr.id === currentInstructorId ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {instr.name}
                        {instr.id === currentInstructorId && (
                          <span className="text-xs text-gray-400 ml-2">(현재)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {instr.school || "학교 미등록"} · 학생 {instr.studentCount}명
                      </p>
                    </div>
                    {selectedId === instr.id && (
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 text-sm"
          >
            취소
          </button>
          <button
            onClick={handleChange}
            disabled={saving || !selectedId || selectedId === currentInstructorId}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            변경
          </button>
        </div>
      </div>
    </div>
  );
}
