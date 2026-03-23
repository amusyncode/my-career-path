import { format } from "date-fns";

interface StudentExportItem {
  name: string;
  email: string | null;
  student_email: string | null;
  school: string | null;
  department: string | null;
  education_level: string;
  grade: number | null;
  target_field: string | null;
  created_at: string;
}

export function exportStudentsToCSV(students: StudentExportItem[]): void {
  const headers = [
    "이름",
    "이메일",
    "학교",
    "학과",
    "학교급",
    "학년",
    "희망분야",
    "등록일",
  ];

  const rows = students.map((s) => [
    s.name,
    s.student_email || s.email || "",
    s.school ?? "",
    s.department ?? "",
    s.education_level === "university" ? "대학교" : "특성화고",
    s.grade ? `${s.grade}학년` : "",
    s.target_field ?? "",
    format(new Date(s.created_at), "yyyy-MM-dd"),
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
