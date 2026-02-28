"use client";

import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import type { StudentListItem } from "@/lib/types";

interface StudentCardListProps {
  students: StudentListItem[];
  onStudentClick: (studentId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isActiveWithin7Days(lastActiveDate: string | null): boolean {
  if (!lastActiveDate) return false;
  return differenceInDays(new Date(), new Date(lastActiveDate)) <= 7;
}

export default function StudentCardList({
  students,
  onStudentClick,
}: StudentCardListProps) {
  return (
    <div>
      {students.map((student) => {
        const isActive = isActiveWithin7Days(student.last_active_date);

        return (
          <div
            key={student.id}
            className="bg-white rounded-lg shadow-sm p-4 mb-3 cursor-pointer active:bg-gray-50"
            onClick={() => onStudentClick(student.id)}
          >
            {/* Top row: Avatar + Name + Grade + Status dot */}
            <div className="flex items-center gap-3">
              {student.avatar_url ? (
                <img
                  src={student.avatar_url}
                  alt={student.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-medium">
                  {getInitials(student.name)}
                </div>
              )}
              <span className="font-medium flex-1 truncate">
                {student.name}
              </span>
              {student.grade !== null && (
                <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">
                  {student.grade}학년
                </span>
              )}
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  isActive ? "bg-green-500" : "bg-gray-300"
                }`}
              />
            </div>

            {/* Middle row: School | Department | Target field */}
            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500 flex-wrap">
              {student.school && <span>{student.school}</span>}
              {student.school && student.department && (
                <span className="text-gray-300">|</span>
              )}
              {student.department && <span>{student.department}</span>}
              {student.target_field && (
                <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full ml-1">
                  {student.target_field}
                </span>
              )}
            </div>

            {/* Bottom row: Project count | Certificate count | Last activity */}
            <div className="flex justify-between text-sm text-gray-500 mt-3 pt-3 border-t border-gray-100">
              <span>
                프로젝트 {student.project_count}
              </span>
              <span>
                자격증 {student.certificate_count}
              </span>
              <span>
                {student.last_active_date
                  ? formatDistanceToNow(new Date(student.last_active_date), {
                      addSuffix: true,
                      locale: ko,
                    })
                  : "활동 없음"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
