import { format } from "date-fns";
import type { StudentListItem } from "@/lib/types";

export function exportStudentsToCSV(students: StudentListItem[]): void {
  const headers = [
    "이름",
    "이메일",
    "학교",
    "학과",
    "학년",
    "희망분야",
    "가입일",
    "최근활동일",
    "프로젝트수",
    "자격증수",
  ];

  const rows = students.map((s) => [
    s.name,
    s.email ?? "",
    s.school ?? "",
    s.department ?? "",
    s.grade ? `${s.grade}학년` : "",
    s.target_field ?? "",
    format(new Date(s.created_at), "yyyy-MM-dd"),
    s.last_active_date
      ? format(new Date(s.last_active_date), "yyyy-MM-dd")
      : "",
    s.project_count.toString(),
    s.certificate_count.toString(),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `학생목록_${format(new Date(), "yyyyMMdd")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
