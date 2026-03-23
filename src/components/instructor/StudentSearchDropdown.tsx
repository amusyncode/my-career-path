"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

interface StudentSearchDropdownProps {
  value: string | null;
  onChange: (studentId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  instructorId: string;
  className?: string;
}

export default function StudentSearchDropdown({
  value,
  onChange,
  placeholder = "학생 선택",
  disabled = false,
  instructorId,
  className = "",
}: StudentSearchDropdownProps) {
  const [students, setStudents] = useState<Profile[]>([]);
  const [filtered, setFiltered] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // 학생 목록 로드
  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .eq("instructor_id", instructorId)
        .eq("is_active", true)
        .order("name");
      if (data) {
        setStudents(data);
        setFiltered(data);
        // 초기 선택 이름 설정
        if (value) {
          const selected = data.find((s) => s.id === value);
          if (selected) setSelectedName(selected.name);
        }
      }
      setIsLoading(false);
    };
    if (instructorId) fetchStudents();
  }, [instructorId, value]);

  // 검색 debounce
  const handleSearch = useCallback(
    (query: string) => {
      setSearch(query);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!query.trim()) {
          setFiltered(students);
        } else {
          const q = query.toLowerCase();
          setFiltered(
            students.filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                (s.school && s.school.toLowerCase().includes(q)) ||
                (s.department && s.department.toLowerCase().includes(q))
            )
          );
        }
      }, 300);
    },
    [students]
  );

  // 외부 클릭 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (student: Profile) => {
    onChange(student.id);
    setSelectedName(student.name);
    setIsOpen(false);
    setSearch("");
    setFiltered(students);
  };

  const eduLabel = (level: string) =>
    level === "high_school" ? "특성화고" : "대학교";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center border rounded-lg px-3 py-2 text-sm cursor-pointer ${
          disabled
            ? "bg-gray-100 cursor-not-allowed"
            : isOpen
            ? "border-purple-400 ring-2 ring-purple-200"
            : "border-gray-200 hover:border-gray-300"
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
        {isOpen ? (
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={placeholder}
            className="flex-1 outline-none bg-transparent text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={value ? "text-gray-900" : "text-gray-400"}>
            {selectedName || placeholder}
          </span>
        )}
        {isLoading && (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin ml-2" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">
              {search ? "검색 결과가 없습니다" : "학생이 없습니다"}
            </div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50 transition ${
                  value === s.id ? "bg-purple-50 text-purple-700" : ""
                }`}
                onClick={() => handleSelect(s)}
              >
                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {s.name.charAt(0)}
                </div>
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-gray-400">
                  {s.school} {s.department}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ml-auto ${
                    s.education_level === "high_school"
                      ? "bg-purple-100 text-purple-600"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {eduLabel(s.education_level)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
