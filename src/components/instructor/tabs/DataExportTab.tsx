"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  FileSpreadsheet,
  Download,
  Loader2,
  UserCheck,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { generateStudentReportPDF, downloadPDF } from "@/lib/pdf-generator";

interface Props {
  instructorId: string;
  instructorName: string;
}

interface StudentOption {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
  education_level: string;
}

const TABLE_OPTIONS = [
  { key: "profiles", label: "학생 프로필" },
  { key: "roadmap_goals", label: "로드맵 목표" },
  { key: "daily_logs", label: "일일 기록" },
  { key: "projects", label: "프로젝트" },
  { key: "certificates", label: "자격증" },
  { key: "skills", label: "스킬" },
  { key: "uploaded_resumes", label: "이력서" },
  { key: "uploaded_cover_letters", label: "자기소개서" },
  { key: "ai_review_results", label: "AI 첨삭 결과" },
  { key: "counseling_records", label: "상담 기록" },
  { key: "email_logs", label: "이메일 이력" },
];

const EXCEL_TABLES = [
  { key: "profiles", label: "학생 프로필", defaultOn: true },
  { key: "roadmap_goals", label: "로드맵 목표", defaultOn: true },
  { key: "daily_logs", label: "일일 기록", defaultOn: true },
  { key: "projects", label: "프로젝트", defaultOn: true },
  { key: "certificates", label: "자격증", defaultOn: true },
  { key: "skills", label: "스킬", defaultOn: true },
  { key: "uploaded_resumes", label: "이력서", defaultOn: false },
  { key: "uploaded_cover_letters", label: "자기소개서", defaultOn: false },
  { key: "ai_review_results", label: "AI 첨삭 결과", defaultOn: false },
  { key: "counseling_records", label: "상담 기록", defaultOn: false },
  { key: "email_logs", label: "이메일 이력", defaultOn: false },
];

const REPORT_SECTIONS = [
  { key: "profile", label: "프로필 정보", defaultOn: true },
  { key: "roadmap", label: "로드맵 & 목표", defaultOn: true },
  { key: "projects", label: "프로젝트 & 포트폴리오", defaultOn: true },
  { key: "certificates", label: "자격증 & 스킬", defaultOn: true },
  { key: "study", label: "학습 기록 & 통계", defaultOn: true },
  { key: "documents", label: "이력서/자소서 & AI 첨삭", defaultOn: false },
  { key: "counseling", label: "상담 기록", defaultOn: false },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export default function DataExportTab({ instructorId, instructorName }: Props) {
  const supabase = createClient();

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, string>>({});

  // CSV state
  const [csvTable, setCsvTable] = useState("profiles");
  const [csvStudent, setCsvStudent] = useState("");
  const [csvEducation, setCsvEducation] = useState("");
  const [csvDateFrom, setCsvDateFrom] = useState("");
  const [csvDateTo, setCsvDateTo] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);

  // Excel state
  const [excelTables, setExcelTables] = useState<Record<string, boolean>>(
    Object.fromEntries(EXCEL_TABLES.map((t) => [t.key, t.defaultOn]))
  );
  const [excelLoading, setExcelLoading] = useState(false);

  // JSON state
  const [jsonLoading, setJsonLoading] = useState(false);

  // Report state
  const [reportStudent, setReportStudent] = useState<StudentOption | null>(null);
  const [reportStudentSearch, setReportStudentSearch] = useState("");
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const [reportFormat, setReportFormat] = useState<"pdf" | "csv">("pdf");
  const [reportSections, setReportSections] = useState<Record<string, boolean>>(
    Object.fromEntries(REPORT_SECTIONS.map((s) => [s.key, s.defaultOn]))
  );
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, school, department, education_level")
        .eq("instructor_id", instructorId)
        .eq("role", "student")
        .order("name");
      const list = (data || []) as StudentOption[];
      setStudents(list);
      const map: Record<string, string> = {};
      list.forEach((s) => { map[s.id] = s.name; });
      setStudentMap(map);
    };
    fetch();
  }, [supabase, instructorId]);

  const studentIds = students.map((s) => s.id);

  // Helper: fetch table data
  const fetchTableData = async (table: string, filterStudentId?: string, filterEducation?: string) => {
    if (studentIds.length === 0) return [];

    const directInstructorTables = ["profiles", "uploaded_resumes", "uploaded_cover_letters", "ai_review_results", "counseling_records", "email_logs"];
    const isDirectInstructor = directInstructorTables.includes(table);

    let targetIds = studentIds;
    if (filterStudentId) targetIds = [filterStudentId];
    else if (filterEducation) {
      targetIds = students.filter((s) => s.education_level === filterEducation).map((s) => s.id);
    }

    if (table === "profiles") {
      let q = supabase.from("profiles").select("*").eq("instructor_id", instructorId).eq("role", "student");
      if (filterEducation) q = q.eq("education_level", filterEducation);
      if (filterStudentId) q = q.eq("id", filterStudentId);
      const { data } = await q;
      return data || [];
    }

    if (table === "email_logs") {
      let q = supabase.from("email_logs").select("*").eq("instructor_id", instructorId);
      if (filterStudentId) q = q.eq("student_id", filterStudentId);
      const { data } = await q;
      return (data || []).map((r: Record<string, unknown>) => ({ ...r, _student_name: studentMap[r.student_id as string] || "" }));
    }

    if (isDirectInstructor) {
      let q = supabase.from(table).select("*").eq("instructor_id", instructorId);
      if (filterStudentId) q = q.eq("user_id", filterStudentId);
      else if (targetIds.length < studentIds.length) q = q.in("user_id", targetIds);
      const { data } = await q;
      return (data || []).map((r: Record<string, unknown>) => ({ ...r, _student_name: studentMap[r.user_id as string] || "" }));
    }

    // Tables with user_id only
    const q = supabase.from(table).select("*").in("user_id", targetIds);
    const { data } = await q;
    return (data || []).map((r: Record<string, unknown>) => ({ ...r, _student_name: studentMap[r.user_id as string] || "" }));
  };

  // CSV export
  const handleCSVExport = async () => {
    setCsvLoading(true);
    try {
      const data = await fetchTableData(csvTable, csvStudent, csvEducation);
      if (data.length === 0) { toast.error("내보낼 데이터가 없습니다."); return; }

      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(","),
        ...data.map((row: Record<string, unknown>) =>
          headers.map((h) => {
            const val = row[h];
            const str = val == null ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          }).join(",")
        ),
      ];
      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${csvTable}_${todayStr()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV 다운로드가 시작됩니다");
    } catch (err) {
      console.error("CSV export error:", err);
      toast.error("CSV 내보내기에 실패했습니다.");
    } finally {
      setCsvLoading(false);
    }
  };

  // Excel export
  const handleExcelExport = async () => {
    setExcelLoading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const selectedTables = Object.entries(excelTables).filter(([, v]) => v).map(([k]) => k);

      for (const table of selectedTables) {
        const data = await fetchTableData(table);
        const label = TABLE_OPTIONS.find((t) => t.key === table)?.label || table;
        if (data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31)); // Sheet name max 31 chars
        }
      }

      XLSX.writeFile(wb, `MyCareerPath_데이터_${todayStr()}.xlsx`);
      toast.success("Excel 다운로드가 시작됩니다");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Excel 내보내기에 실패했습니다.");
    } finally {
      setExcelLoading(false);
    }
  };

  // JSON export
  const handleJSONExport = async () => {
    setJsonLoading(true);
    try {
      const allData: Record<string, unknown[]> = {};
      for (const table of TABLE_OPTIONS) {
        allData[table.key] = await fetchTableData(table.key);
      }
      const jsonStr = JSON.stringify(allData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MyCareerPath_backup_${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("JSON 다운로드가 시작됩니다");
    } catch (err) {
      console.error("JSON export error:", err);
      toast.error("JSON 백업에 실패했습니다.");
    } finally {
      setJsonLoading(false);
    }
  };

  // Student report
  const handleReportExport = async () => {
    if (!reportStudent) { toast.error("학생을 선택해주세요."); return; }
    setReportLoading(true);
    try {
      const sid = reportStudent.id;

      // Fetch all needed data
      const [goalsRes, projectsRes, certsRes, skillsRes, logsRes, reviewsRes, counselingRes, streakRes] = await Promise.all([
        reportSections.roadmap ? supabase.from("roadmap_goals").select("title, category, status, target_date").eq("user_id", sid) : { data: [] },
        reportSections.projects ? supabase.from("projects").select("title, tech_stack, status, created_at").eq("user_id", sid) : { data: [] },
        reportSections.certificates ? supabase.from("certificates").select("name, issuer, acquired_date, score").eq("user_id", sid) : { data: [] },
        reportSections.certificates ? supabase.from("skills").select("name, category, level").eq("user_id", sid) : { data: [] },
        reportSections.study ? supabase.from("daily_logs").select("study_hours").eq("user_id", sid) : { data: [] },
        reportSections.documents ? supabase.from("ai_review_results").select("document_type, model_used, score, created_at").eq("user_id", sid) : { data: [] },
        reportSections.counseling ? supabase.from("counseling_records").select("counseling_type, title, counseling_date, is_completed").eq("user_id", sid) : { data: [] },
        supabase.from("streaks").select("current_streak").eq("user_id", sid).single(),
      ]);

      const totalHours = (logsRes.data || []).reduce((sum: number, l: Record<string, unknown>) => sum + ((l.study_hours as number) || 0), 0);

      if (reportFormat === "pdf") {
        const doc = generateStudentReportPDF({
          studentName: reportStudent.name,
          school: reportStudent.school || "",
          department: reportStudent.department || "",
          educationLevel: reportStudent.education_level as "high_school" | "university",
          grade: "",
          instructorName,
          generatedDate: new Date().toLocaleDateString("ko-KR"),
          stats: {
            goals: (goalsRes.data || []).length,
            projects: (projectsRes.data || []).length,
            certificates: (certsRes.data || []).length,
            studyHours: Math.round(totalHours),
            streak: streakRes.data?.current_streak || 0,
          },
          roadmapGoals: reportSections.roadmap ? goalsRes.data || [] : undefined,
          projects: reportSections.projects ? projectsRes.data || [] : undefined,
          certificates: reportSections.certificates ? (certsRes.data || []).map((c: Record<string, unknown>) => ({
            name: c.name as string,
            status: c.acquired_date ? "acquired" : "planned",
            target_date: (c.acquired_date as string) || undefined,
          })) : undefined,
          skills: reportSections.certificates ? (skillsRes.data || []).map((s: Record<string, unknown>) => ({
            skill_name: s.name as string,
            proficiency_level: (s.level as number) || undefined,
          })) : undefined,
          aiReviews: reportSections.documents ? reviewsRes.data || [] : undefined,
          counselingRecords: reportSections.counseling ? counselingRes.data || [] : undefined,
        });
        downloadPDF(doc, `${reportStudent.name}_리포트_${todayStr()}`);
        toast.success("학생 리포트 PDF 다운로드가 시작됩니다");
      } else {
        // CSV report
        const sections: string[] = [];
        if (reportSections.profile) {
          sections.push(`[프로필]\n이름,학교,학과,학교급\n"${reportStudent.name}","${reportStudent.school || ""}","${reportStudent.department || ""}","${reportStudent.education_level === "high_school" ? "특성화고" : "대학교"}"`);
        }
        if (reportSections.roadmap && goalsRes.data?.length) {
          sections.push(`\n[로드맵 목표]\n목표명,카테고리,상태,마감일\n${(goalsRes.data || []).map((g: Record<string, unknown>) => `"${g.title}","${g.category}","${g.status}","${g.target_date || ""}"`).join("\n")}`);
        }
        if (reportSections.projects && projectsRes.data?.length) {
          sections.push(`\n[프로젝트]\n프로젝트명,기술스택,상태,생성일\n${(projectsRes.data || []).map((p: Record<string, unknown>) => `"${p.title}","${Array.isArray(p.tech_stack) ? (p.tech_stack as string[]).join(";") : ""}","${p.status}","${p.created_at}"`).join("\n")}`);
        }
        if (reportSections.certificates && certsRes.data?.length) {
          sections.push(`\n[자격증]\n자격증명,발급기관,취득일,등급\n${(certsRes.data || []).map((c: Record<string, unknown>) => `"${c.name}","${c.issuer || ""}","${c.acquired_date || ""}","${c.score || ""}"`).join("\n")}`);
        }
        const csvContent = "\uFEFF" + sections.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportStudent.name}_리포트_${todayStr()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV 리포트 다운로드가 시작됩니다");
      }
    } catch (err) {
      console.error("Report export error:", err);
      toast.error("리포트 생성에 실패했습니다.");
    } finally {
      setReportLoading(false);
    }
  };

  const filteredReportStudents = students.filter(
    (s) => s.name.includes(reportStudentSearch) || s.school?.includes(reportStudentSearch) || s.department?.includes(reportStudentSearch)
  );

  const allExcelSelected = Object.values(excelTables).every(Boolean);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* CSV */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-10 h-10 text-green-500" />
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">CSV 내보내기</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">선택한 테이블을 CSV 파일로 다운로드합니다</p>
          </div>
        </div>
        <div className="space-y-3">
          <select value={csvTable} onChange={(e) => setCsvTable(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            {TABLE_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select value={csvStudent} onChange={(e) => setCsvStudent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">전체 학생</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={csvEducation} onChange={(e) => setCsvEducation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">전체 학교급</option>
            <option value="high_school">특성화고</option>
            <option value="university">대학교</option>
          </select>
          <div className="flex gap-2">
            <input type="date" value={csvDateFrom} onChange={(e) => setCsvDateFrom(e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
            <span className="text-gray-400 self-center">~</span>
            <input type="date" value={csvDateTo} onChange={(e) => setCsvDateTo(e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>
          <button onClick={handleCSVExport} disabled={csvLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-500 text-white rounded-lg px-4 py-2.5 hover:bg-green-600 disabled:opacity-50 transition-colors font-medium">
            {csvLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            CSV 다운로드
          </button>
        </div>
      </div>

      {/* Excel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-10 h-10 text-blue-500" />
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Excel 내보내기</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">전체 데이터를 하나의 Excel 파일로 다운로드합니다</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {EXCEL_TABLES.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={excelTables[t.key]} onChange={(e) => setExcelTables((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-400" />
                <span className="text-gray-700 dark:text-gray-300">{t.label}</span>
              </label>
            ))}
          </div>
          <button onClick={() => setExcelTables(Object.fromEntries(EXCEL_TABLES.map((t) => [t.key, !allExcelSelected])))}
            className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700">
            {allExcelSelected ? "전체 해제" : "전체 선택"}
          </button>
          <button onClick={handleExcelExport} disabled={excelLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white rounded-lg px-4 py-2.5 hover:bg-blue-600 disabled:opacity-50 transition-colors font-medium">
            {excelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Excel 다운로드
          </button>
        </div>
      </div>

      {/* JSON */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-500 font-bold text-lg">{ }</div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">JSON 전체 백업</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">모든 데이터를 JSON으로 백업합니다</p>
          </div>
        </div>
        <button onClick={handleJSONExport} disabled={jsonLoading}
          className="w-full flex items-center justify-center gap-2 bg-purple-500 text-white rounded-lg px-4 py-2.5 hover:bg-purple-600 disabled:opacity-50 transition-colors font-medium">
          {jsonLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          JSON 다운로드
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">※ 첨부 파일(이미지, PDF)은 포함되지 않습니다</p>
      </div>

      {/* Student Report */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <UserCheck className="w-10 h-10 text-orange-500" />
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">학생 개별 리포트</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">특정 학생의 전체 데이터를 정리된 리포트로 다운로드합니다</p>
          </div>
        </div>
        <div className="space-y-3">
          {/* Student search */}
          {reportStudent ? (
            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{reportStudent.name}
                <span className="text-orange-400 ml-2 text-xs">{[reportStudent.school, reportStudent.department].filter(Boolean).join(" · ")}</span>
              </span>
              <button onClick={() => setReportStudent(null)} className="text-xs text-orange-500 hover:text-orange-700">변경</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={reportStudentSearch}
                onChange={(e) => { setReportStudentSearch(e.target.value); setShowReportDropdown(true); }}
                onFocus={() => setShowReportDropdown(true)}
                placeholder="학생 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              {showReportDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredReportStudents.length === 0 ? (
                    <p className="text-sm text-gray-400 p-3">검색 결과 없음</p>
                  ) : filteredReportStudents.map((s) => (
                    <button key={s.id} onClick={() => { setReportStudent(s); setShowReportDropdown(false); setReportStudentSearch(""); }}
                      className="w-full text-left px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                      <span className="text-gray-400 ml-2 text-xs">{[s.school, s.department].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Format */}
          <select value={reportFormat} onChange={(e) => setReportFormat(e.target.value as "pdf" | "csv")}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
          </select>

          {/* Sections */}
          <div className="space-y-1">
            {REPORT_SECTIONS.map((s) => (
              <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={reportSections[s.key]} onChange={(e) => setReportSections((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400" />
                <span className="text-gray-700 dark:text-gray-300">{s.label}</span>
              </label>
            ))}
          </div>

          <button onClick={handleReportExport} disabled={reportLoading || !reportStudent}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white rounded-lg px-4 py-2.5 hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium">
            {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            리포트 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
