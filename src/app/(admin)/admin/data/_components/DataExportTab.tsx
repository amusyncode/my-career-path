"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  FileSpreadsheet,
  Download,
  Braces,
  UserCheck,
  Search,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface StudentOption {
  id: string;
  name: string;
  school: string | null;
}

const ALL_TABLES = [
  { key: "profiles", label: "학생 프로필", default: true },
  { key: "roadmap_goals", label: "로드맵 목표", default: true },
  { key: "daily_logs", label: "일일 기록", default: true },
  { key: "projects", label: "프로젝트", default: true },
  { key: "certificates", label: "자격증", default: true },
  { key: "skills", label: "스킬", default: true },
  { key: "uploaded_resumes", label: "이력서", default: false },
  { key: "uploaded_cover_letters", label: "자기소개서", default: false },
  { key: "ai_review_results", label: "AI 첨삭 결과", default: false },
  { key: "counseling_records", label: "상담 기록", default: false },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function arrayToCSV(headers: string[], rows: string[][]): string {
  const csvRows = [headers, ...rows].map((row) =>
    row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return "\uFEFF" + csvRows.join("\n");
}

export default function DataExportTab() {
  const supabase = createClient();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [csvTable, setCsvTable] = useState("profiles");
  const [csvDateFrom, setCsvDateFrom] = useState("");
  const [csvDateTo, setCsvDateTo] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const [excelTables, setExcelTables] = useState<string[]>(
    ALL_TABLES.filter((t) => t.default).map((t) => t.key)
  );
  const [excelLoading, setExcelLoading] = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [reportStudent, setReportStudent] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSections, setReportSections] = useState([
    "profile",
    "roadmap",
    "projects",
    "certificates",
    "study",
  ]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, school")
        .eq("role", "student")
        .order("name");
      setStudents(data || []);
    })();
  }, [supabase]);

  const fetchTableData = useCallback(
    async (tableName: string, dateFrom?: string, dateTo?: string) => {
      let query = supabase.from(tableName).select("*");
      if (tableName === "profiles") query = query.eq("role", "student");

      const dateField =
        tableName === "daily_logs"
          ? "log_date"
          : tableName === "counseling_records"
          ? "counseling_date"
          : tableName === "ai_review_results"
          ? "reviewed_at"
          : tableName === "uploaded_resumes" || tableName === "uploaded_cover_letters"
          ? "uploaded_at"
          : "created_at";

      if (dateFrom) query = query.gte(dateField, dateFrom);
      if (dateTo) query = query.lte(dateField, dateTo + "T23:59:59");

      const { data } = await query;
      return data || [];
    },
    [supabase]
  );

  // CSV 다운로드
  const handleCSVExport = async () => {
    setCsvLoading(true);
    try {
      const rows = await fetchTableData(csvTable, csvDateFrom, csvDateTo);
      if (rows.length === 0) {
        toast.error("내보낼 데이터가 없습니다");
        return;
      }
      const headers = Object.keys(rows[0]);
      const csvRows = rows.map((r) =>
        headers.map((h) => {
          const v = r[h];
          if (v === null || v === undefined) return "";
          if (Array.isArray(v)) return v.join(", ");
          if (typeof v === "object") return JSON.stringify(v);
          return String(v);
        })
      );
      const csv = arrayToCSV(headers, csvRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const dateStr = format(new Date(), "yyyyMMdd");
      downloadBlob(blob, `${csvTable}_${dateStr}.csv`);
      toast.success("CSV 다운로드 완료");
    } catch (err) {
      console.error(err);
      toast.error("CSV 내보내기 실패");
    } finally {
      setCsvLoading(false);
    }
  };

  // Excel 다운로드
  const handleExcelExport = async () => {
    if (excelTables.length === 0) {
      toast.error("최소 1개 테이블을 선택하세요");
      return;
    }
    setExcelLoading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      for (const tKey of excelTables) {
        const tInfo = ALL_TABLES.find((t) => t.key === tKey);
        const rows = await fetchTableData(tKey);
        if (rows.length > 0) {
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, tInfo?.label || tKey);
        }
      }

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const dateStr = format(new Date(), "yyyyMMdd");
      downloadBlob(blob, `MyCareerPath_전체데이터_${dateStr}.xlsx`);
      toast.success("Excel 다운로드 완료");
    } catch (err) {
      console.error(err);
      toast.error("Excel 내보내기 실패");
    } finally {
      setExcelLoading(false);
    }
  };

  // JSON 백업
  const handleJSONExport = async () => {
    setJsonLoading(true);
    try {
      const backup: Record<string, unknown[]> = {};
      for (const t of ALL_TABLES) {
        backup[t.key] = await fetchTableData(t.key);
      }
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const dateStr = format(new Date(), "yyyyMMdd");
      downloadBlob(blob, `MyCareerPath_backup_${dateStr}.json`);
      toast.success("JSON 백업 다운로드 완료");
    } catch (err) {
      console.error(err);
      toast.error("JSON 백업 실패");
    } finally {
      setJsonLoading(false);
    }
  };

  // 학생 개별 리포트
  const handleStudentReport = async () => {
    if (!reportStudent) {
      toast.error("학생을 선택하세요");
      return;
    }
    setReportLoading(true);
    try {
      const sid = reportStudent;
      const studentName =
        students.find((s) => s.id === sid)?.name || "학생";
      const allRows: string[][] = [];
      const headers: string[] = [];

      if (reportSections.includes("profile")) {
        const { data } = await supabase
          .from("profiles")
          .select("name, email, school, department, grade, target_field, bio, created_at")
          .eq("id", sid)
          .single();
        if (data) {
          allRows.push(["=== 프로필 정보 ==="]);
          Object.entries(data).forEach(([k, v]) =>
            allRows.push([k, String(v ?? "")])
          );
          allRows.push([""]);
        }
      }

      if (reportSections.includes("roadmap")) {
        const { data } = await supabase
          .from("roadmap_goals")
          .select("title, category, status, target_date, created_at")
          .eq("user_id", sid);
        if (data && data.length > 0) {
          allRows.push(["=== 로드맵 목표 ==="]);
          allRows.push(["제목", "카테고리", "상태", "마감일", "생성일"]);
          data.forEach((r) =>
            allRows.push([r.title, r.category, r.status, r.target_date || "", r.created_at])
          );
          allRows.push([""]);
        }
      }

      if (reportSections.includes("projects")) {
        const { data } = await supabase
          .from("projects")
          .select("title, description, tech_stack, status, created_at")
          .eq("user_id", sid);
        if (data && data.length > 0) {
          allRows.push(["=== 프로젝트 ==="]);
          allRows.push(["프로젝트명", "설명", "기술스택", "상태", "생성일"]);
          data.forEach((r) =>
            allRows.push([
              r.title,
              r.description || "",
              (r.tech_stack || []).join(", "),
              r.status,
              r.created_at,
            ])
          );
          allRows.push([""]);
        }
      }

      if (reportSections.includes("certificates")) {
        const { data: certs } = await supabase
          .from("certificates")
          .select("name, issuer, acquired_date, score")
          .eq("user_id", sid);
        const { data: skills } = await supabase
          .from("skills")
          .select("name, category, level")
          .eq("user_id", sid);

        if (certs && certs.length > 0) {
          allRows.push(["=== 자격증 ==="]);
          allRows.push(["자격증명", "발급기관", "취득일", "등급/점수"]);
          certs.forEach((r) =>
            allRows.push([r.name, r.issuer || "", r.acquired_date || "", r.score || ""])
          );
          allRows.push([""]);
        }
        if (skills && skills.length > 0) {
          allRows.push(["=== 스킬 ==="]);
          allRows.push(["스킬명", "카테고리", "레벨"]);
          skills.forEach((r) =>
            allRows.push([r.name, r.category || "", String(r.level)])
          );
          allRows.push([""]);
        }
      }

      if (reportSections.includes("study")) {
        const { data } = await supabase
          .from("daily_logs")
          .select("log_date, study_hours, mood, daily_goal, reflection")
          .eq("user_id", sid)
          .order("log_date", { ascending: false })
          .limit(30);
        if (data && data.length > 0) {
          allRows.push(["=== 학습 기록 (최근 30일) ==="]);
          allRows.push(["날짜", "학습시간", "기분", "일일목표", "메모"]);
          data.forEach((r) =>
            allRows.push([
              r.log_date,
              String(r.study_hours),
              String(r.mood ?? ""),
              r.daily_goal || "",
              r.reflection || "",
            ])
          );
          allRows.push([""]);
        }
      }

      if (reportSections.includes("resume")) {
        const { data: resumes } = await supabase
          .from("uploaded_resumes")
          .select("title, file_name, status, uploaded_at")
          .eq("user_id", sid);
        const { data: cls } = await supabase
          .from("uploaded_cover_letters")
          .select("title, file_name, status, uploaded_at")
          .eq("user_id", sid);

        if ((resumes?.length || 0) > 0 || (cls?.length || 0) > 0) {
          allRows.push(["=== 이력서/자소서 ==="]);
          allRows.push(["유형", "제목", "파일명", "상태", "업로드일"]);
          resumes?.forEach((r) =>
            allRows.push(["이력서", r.title || "", r.file_name, r.status, r.uploaded_at])
          );
          cls?.forEach((r) =>
            allRows.push(["자소서", r.title || "", r.file_name, r.status, r.uploaded_at])
          );
          allRows.push([""]);
        }
      }

      if (reportSections.includes("counseling")) {
        const { data } = await supabase
          .from("counseling_records")
          .select("counseling_type, title, content, counseling_date, is_completed")
          .eq("user_id", sid)
          .order("counseling_date", { ascending: false });
        if (data && data.length > 0) {
          allRows.push(["=== 상담 기록 ==="]);
          allRows.push(["유형", "제목", "내용", "상담일", "완료"]);
          data.forEach((r) =>
            allRows.push([
              r.counseling_type,
              r.title,
              r.content || "",
              r.counseling_date,
              r.is_completed ? "완료" : "진행중",
            ])
          );
        }
      }

      if (allRows.length === 0) {
        toast.error("내보낼 데이터가 없습니다");
        return;
      }

      // 최대 열 수 맞추기
      const maxCols = Math.max(...allRows.map((r) => r.length), headers.length);
      const paddedRows = allRows.map((r) => {
        while (r.length < maxCols) r.push("");
        return r;
      });

      const csv = arrayToCSV(
        Array.from({ length: maxCols }, (_, i) => (i === 0 ? "항목" : `값${i}`)),
        paddedRows
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const dateStr = format(new Date(), "yyyyMMdd");
      downloadBlob(blob, `${studentName}_리포트_${dateStr}.csv`);
      toast.success("리포트 다운로드 완료");
    } catch (err) {
      console.error(err);
      toast.error("리포트 생성 실패");
    } finally {
      setReportLoading(false);
    }
  };

  const toggleExcelTable = (key: string) => {
    setExcelTables((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleReportSection = (key: string) => {
    setReportSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filteredStudents = reportSearch
    ? students.filter(
        (s) =>
          s.name.includes(reportSearch) ||
          (s.school && s.school.includes(reportSearch))
      )
    : students;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* CSV */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">CSV 내보내기</h3>
            <p className="text-sm text-gray-500">
              선택한 테이블 데이터를 CSV 파일로 다운로드
            </p>
          </div>
        </div>

        <select
          value={csvTable}
          onChange={(e) => setCsvTable(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
        >
          {ALL_TABLES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 mb-4 text-sm">
          <input
            type="date"
            value={csvDateFrom}
            onChange={(e) => setCsvDateFrom(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={csvDateTo}
            onChange={(e) => setCsvDateTo(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        <button
          onClick={handleCSVExport}
          disabled={csvLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {csvLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          CSV 다운로드
        </button>
      </div>

      {/* Excel */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Excel 내보내기</h3>
            <p className="text-sm text-gray-500">
              각 테이블이 별도 시트로 저장됩니다
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {ALL_TABLES.map((t) => (
            <label
              key={t.key}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={excelTables.includes(t.key)}
                onChange={() => toggleExcelTable(t.key)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              {t.label}
            </label>
          ))}
        </div>

        <div className="flex gap-2 text-xs mb-4">
          <button
            onClick={() => setExcelTables(ALL_TABLES.map((t) => t.key))}
            className="text-purple-600 hover:underline"
          >
            전체 선택
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setExcelTables([])}
            className="text-purple-600 hover:underline"
          >
            전체 해제
          </button>
        </div>

        <button
          onClick={handleExcelExport}
          disabled={excelLoading || excelTables.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {excelLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Excel 다운로드
        </button>
      </div>

      {/* JSON */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Braces className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">JSON 전체 백업</h3>
            <p className="text-sm text-gray-500">
              모든 테이블 데이터를 JSON 파일로 백업
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          데이터 복원시 사용할 수 있는 전체 백업 파일입니다.
        </p>

        <button
          onClick={handleJSONExport}
          disabled={jsonLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
        >
          {jsonLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          JSON 백업 다운로드
        </button>
        <p className="text-xs text-gray-400 mt-2">
          ※ 파일 첨부물(이미지, PDF 등)은 포함되지 않습니다
        </p>
      </div>

      {/* 학생 개별 리포트 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">학생 개별 리포트</h3>
            <p className="text-sm text-gray-500">
              특정 학생의 전체 데이터를 정리된 리포트로 다운로드
            </p>
          </div>
        </div>

        {/* 학생 검색/선택 */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={reportSearch}
            onChange={(e) => setReportSearch(e.target.value)}
            placeholder="학생 이름으로 검색..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <select
          value={reportStudent}
          onChange={(e) => setReportStudent(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
        >
          <option value="">학생을 선택하세요</option>
          {filteredStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.school ? `(${s.school})` : ""}
            </option>
          ))}
        </select>

        {/* 포함 항목 */}
        <div className="space-y-1.5 mb-4">
          {[
            { key: "profile", label: "프로필 정보" },
            { key: "roadmap", label: "로드맵 & 목표" },
            { key: "projects", label: "프로젝트 & 포트폴리오" },
            { key: "certificates", label: "자격증 & 스킬" },
            { key: "study", label: "학습 기록 & 통계" },
            { key: "resume", label: "이력서/자소서 & AI 첨삭 결과" },
            { key: "counseling", label: "상담 기록" },
          ].map((s) => (
            <label
              key={s.key}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={reportSections.includes(s.key)}
                onChange={() => toggleReportSection(s.key)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              {s.label}
            </label>
          ))}
        </div>

        <button
          onClick={handleStudentReport}
          disabled={reportLoading || !reportStudent}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {reportLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          리포트 다운로드
        </button>
      </div>
    </div>
  );
}
