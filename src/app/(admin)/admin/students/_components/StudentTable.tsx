"use client";

import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { differenceInDays } from "date-fns/differenceInDays";
import { ko } from "date-fns/locale/ko";
import type { StudentListItem } from "@/lib/types";

interface StudentTableProps {
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

function isActive(lastActiveDate: string | null): boolean {
  if (!lastActiveDate) return false;
  return differenceInDays(new Date(), new Date(lastActiveDate)) <= 7;
}

export default function StudentTable({
  students,
  onStudentClick,
}: StudentTableProps) {
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-gray-50 text-sm text-gray-500 font-medium">
          <th className="text-left px-4 py-3">학생</th>
          <th className="text-left px-4 py-3">학교/학과</th>
          <th className="text-left px-4 py-3">학년</th>
          <th className="text-left px-4 py-3">희망분야</th>
          <th className="text-left px-4 py-3">프로젝트</th>
          <th className="text-left px-4 py-3">자격증</th>
          <th className="text-left px-4 py-3">최근활동</th>
          <th className="text-left px-4 py-3">상태</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => {
          const active = isActive(student.last_active_date);

          return (
            <tr
              key={student.id}
              onClick={() => onStudentClick(student.id)}
              className="hover:bg-purple-50 cursor-pointer transition-colors border-t border-gray-100"
            >
              {/* 학생 */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {student.avatar_url ? (
                    <img
                      src={student.avatar_url}
                      alt={student.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">
                      {getInitials(student.name)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-sm">{student.name}</div>
                    {student.email && (
                      <div className="text-xs text-gray-400">
                        {student.email}
                      </div>
                    )}
                  </div>
                </div>
              </td>

              {/* 학교/학과 */}
              <td className="px-4 py-3">
                <div className="text-sm">{student.school ?? "-"}</div>
                {student.department && (
                  <div className="text-xs text-gray-400">
                    {student.department}
                  </div>
                )}
              </td>

              {/* 학년 */}
              <td className="px-4 py-3 text-sm">
                {student.grade ? `${student.grade}학년` : "-"}
              </td>

              {/* 희망분야 */}
              <td className="px-4 py-3">
                {student.target_field ? (
                  <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                    {student.target_field}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </td>

              {/* 프로젝트 */}
              <td className="px-4 py-3 text-sm font-medium">
                {student.project_count}
              </td>

              {/* 자격증 */}
              <td className="px-4 py-3 text-sm font-medium">
                {student.certificate_count}
              </td>

              {/* 최근활동 */}
              <td className="px-4 py-3 text-sm">
                {student.last_active_date ? (
                  <span>
                    {formatDistanceToNow(new Date(student.last_active_date), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                ) : (
                  <span className="text-gray-300">활동 없음</span>
                )}
              </td>

              {/* 상태 */}
              <td className="px-4 py-3 text-sm">
                {active ? (
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full inline-block mr-1 bg-green-500" />
                    활성
                  </span>
                ) : (
                  <span className="flex items-center text-gray-400">
                    <span className="w-2 h-2 rounded-full inline-block mr-1 bg-gray-300" />
                    비활성
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
