"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Database,
} from "lucide-react";
import { format } from "date-fns";

interface TableConfig {
  key: string;
  label: string;
  columns: { key: string; label: string; sortable?: boolean }[];
  selectQuery: string;
  hasUserId?: boolean;
  dateField?: string;
}

const TABLES: TableConfig[] = [
  {
    key: "profiles",
    label: "학생 프로필",
    columns: [
      { key: "name", label: "이름", sortable: true },
      { key: "email", label: "이메일" },
      { key: "school", label: "학교" },
      { key: "department", label: "학과" },
      { key: "grade", label: "학년", sortable: true },
      { key: "role", label: "역할" },
      { key: "created_at", label: "가입일", sortable: true },
    ],
    selectQuery: "id, name, email, school, department, grade, role, created_at",
    dateField: "created_at",
  },
  {
    key: "roadmap_goals",
    label: "로드맵 목표",
    columns: [
      { key: "_student", label: "학생" },
      { key: "title", label: "목표 제목" },
      { key: "category", label: "카테고리" },
      { key: "status", label: "상태" },
      { key: "target_date", label: "마감일", sortable: true },
      { key: "created_at", label: "생성일", sortable: true },
    ],
    selectQuery: "id, user_id, title, category, status, target_date, created_at",
    hasUserId: true,
    dateField: "created_at",
  },
  {
    key: "milestones",
    label: "마일스톤",
    columns: [
      { key: "goal_id", label: "목표ID" },
      { key: "title", label: "마일스톤 제목" },
      { key: "is_completed", label: "완료여부" },
      { key: "target_date", label: "목표일" },
    ],
    selectQuery: "id, goal_id, title, is_completed, target_date",
    dateField: "target_date",
  },
  {
    key: "daily_logs",
    label: "일일 기록",
    columns: [
      { key: "_student", label: "학생" },
      { key: "log_date", label: "날짜", sortable: true },
      { key: "study_hours", label: "학습시간", sortable: true },
      { key: "mood", label: "기분" },
      { key: "daily_goal", label: "일일목표" },
      { key: "reflection", label: "메모" },
    ],
    selectQuery: "id, user_id, log_date, study_hours, mood, daily_goal, reflection",
    hasUserId: true,
    dateField: "log_date",
  },
  {
    key: "daily_tasks",
    label: "일일 태스크",
    columns: [
      { key: "daily_log_id", label: "기록ID" },
      { key: "title", label: "태스크 내용" },
      { key: "is_completed", label: "완료여부" },
    ],
    selectQuery: "id, daily_log_id, title, is_completed",
  },
  {
    key: "projects",
    label: "프로젝트",
    columns: [
      { key: "_student", label: "학생" },
      { key: "title", label: "프로젝트명" },
      { key: "description", label: "설명" },
      { key: "tech_stack", label: "기술스택" },
      { key: "status", label: "상태" },
      { key: "created_at", label: "생성일", sortable: true },
    ],
    selectQuery: "id, user_id, title, description, tech_stack, status, created_at",
    hasUserId: true,
    dateField: "created_at",
  },
  {
    key: "certificates",
    label: "자격증",
    columns: [
      { key: "_student", label: "학생" },
      { key: "name", label: "자격증명" },
      { key: "issuer", label: "발급기관" },
      { key: "acquired_date", label: "취득일", sortable: true },
      { key: "score", label: "등급/점수" },
    ],
    selectQuery: "id, user_id, name, issuer, acquired_date, score",
    hasUserId: true,
    dateField: "acquired_date",
  },
  {
    key: "skills",
    label: "스킬",
    columns: [
      { key: "_student", label: "학생" },
      { key: "name", label: "스킬명" },
      { key: "category", label: "카테고리" },
      { key: "level", label: "레벨", sortable: true },
    ],
    selectQuery: "id, user_id, name, category, level",
    hasUserId: true,
  },
  {
    key: "uploaded_resumes",
    label: "이력서",
    columns: [
      { key: "_student", label: "학생" },
      { key: "title", label: "제목" },
      { key: "file_name", label: "파일명" },
      { key: "file_type", label: "파일유형" },
      { key: "file_size", label: "크기" },
      { key: "status", label: "상태" },
      { key: "uploaded_at", label: "업로드일", sortable: true },
    ],
    selectQuery: "id, user_id, title, file_name, file_type, file_size, status, uploaded_by, uploaded_at",
    hasUserId: true,
    dateField: "uploaded_at",
  },
  {
    key: "uploaded_cover_letters",
    label: "자기소개서",
    columns: [
      { key: "_student", label: "학생" },
      { key: "title", label: "제목" },
      { key: "file_name", label: "파일명" },
      { key: "file_type", label: "파일유형" },
      { key: "status", label: "상태" },
      { key: "uploaded_at", label: "업로드일", sortable: true },
    ],
    selectQuery: "id, user_id, title, file_name, file_type, status, uploaded_by, uploaded_at",
    hasUserId: true,
    dateField: "uploaded_at",
  },
  {
    key: "ai_review_results",
    label: "AI 첨삭 결과",
    columns: [
      { key: "_student", label: "학생" },
      { key: "document_type", label: "문서유형" },
      { key: "overall_score", label: "점수", sortable: true },
      { key: "model_name", label: "모델" },
      { key: "input_tokens", label: "입력토큰" },
      { key: "output_tokens", label: "출력토큰" },
      { key: "reviewed_at", label: "처리일", sortable: true },
    ],
    selectQuery: "id, user_id, document_type, overall_score, model_name, input_tokens, output_tokens, reviewed_at",
    hasUserId: true,
    dateField: "reviewed_at",
  },
  {
    key: "counseling_records",
    label: "상담 기록",
    columns: [
      { key: "_student", label: "학생" },
      { key: "counseling_type", label: "상담유형" },
      { key: "title", label: "제목" },
      { key: "counseling_date", label: "상담일", sortable: true },
      { key: "is_completed", label: "완료여부" },
    ],
    selectQuery: "id, user_id, counseling_type, title, counseling_date, is_completed, counselor_id",
    hasUserId: true,
    dateField: "counseling_date",
  },
];

const PAGE_SIZE = 20;

export default function DataBrowseTab() {
  const supabase = createClient();
  const [selectedTable, setSelectedTable] = useState("profiles");
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const tableConfig = TABLES.find((t) => t.key === selectedTable)!;

  // 프로필 맵 로드
  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name");
      if (profiles) {
        setProfileMap(new Map(profiles.map((p) => [p.id, p.name || "이름없음"])));
      }
    })();
  }, [supabase]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const cfg = TABLES.find((t) => t.key === selectedTable)!;
      let query = supabase
        .from(selectedTable)
        .select(cfg.selectQuery, { count: "exact" });

      // 프로필 테이블은 학생만
      if (selectedTable === "profiles") {
        query = query.eq("role", "student");
      }

      // 날짜 필터
      if (dateFrom && cfg.dateField) {
        query = query.gte(cfg.dateField, dateFrom);
      }
      if (dateTo && cfg.dateField) {
        query = query.lte(cfg.dateField, dateTo + "T23:59:59");
      }

      // 정렬
      if (sortCol) {
        query = query.order(sortCol, { ascending: sortAsc });
      } else if (cfg.dateField) {
        query = query.order(cfg.dateField, { ascending: false });
      }

      // 페이지네이션
      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data: rows, count, error } = await query;
      if (error) throw error;

      setData((rows || []) as unknown as Record<string, unknown>[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("데이터 조회 오류:", err);
      setData([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, selectedTable, page, sortCol, sortAsc, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 테이블 변경시 리셋
  useEffect(() => {
    setPage(1);
    setSortCol(null);
    setSortAsc(true);
    setSearch("");
  }, [selectedTable]);

  const handleSort = (colKey: string) => {
    if (sortCol === colKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(colKey);
      setSortAsc(true);
    }
    setPage(1);
  };

  // 검색 필터 (클라이언트 사이드)
  const filteredData = search
    ? data.filter((row) =>
        Object.values(row).some(
          (v) =>
            typeof v === "string" &&
            v.toLowerCase().includes(search.toLowerCase())
        )
      )
    : data;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatCell = (colKey: string, value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (colKey === "_student") return "";
    if (colKey === "is_completed") return value ? "✅ 완료" : "⏳ 미완료";
    if (colKey === "tech_stack" && Array.isArray(value)) return value.join(", ");
    if (colKey === "file_size" && typeof value === "number") {
      return value < 1024 * 1024
        ? `${(value / 1024).toFixed(0)}KB`
        : `${(value / 1024 / 1024).toFixed(1)}MB`;
    }
    if (colKey === "document_type") {
      return value === "resume" ? "이력서" : value === "cover_letter" ? "자소서" : String(value);
    }
    if (colKey === "counseling_type") {
      const map: Record<string, string> = {
        career: "진로",
        resume: "이력서",
        interview: "면접",
        mental: "고충",
        other: "기타",
      };
      return map[String(value)] || String(value);
    }
    if (colKey === "status") {
      const map: Record<string, string> = {
        uploaded: "대기",
        reviewing: "분석중",
        reviewed: "완료",
        failed: "실패",
        planning: "계획",
        in_progress: "진행중",
        completed: "완료",
        planned: "계획",
        paused: "일시중지",
      };
      return map[String(value)] || String(value);
    }
    if (
      typeof value === "string" &&
      (colKey.includes("date") || colKey.includes("_at")) &&
      !isNaN(Date.parse(value))
    ) {
      try {
        return format(new Date(value), "yyyy.MM.dd");
      } catch {
        return String(value);
      }
    }
    if (colKey === "mood" && typeof value === "number") {
      const moods = ["", "😢", "😔", "😐", "😊", "😄"];
      return moods[value] || String(value);
    }
    const str = String(value);
    return str.length > 50 ? str.slice(0, 50) + "..." : str;
  };

  return (
    <div>
      {/* 필터 바 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap items-center gap-3">
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
        >
          {TABLES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>

        {tableConfig.dateField && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="데이터 검색..."
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-56"
          />
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
            데이터를 불러오는 중...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              선택한 테이블에 데이터가 없습니다
            </p>
            <p className="text-sm text-gray-400 mt-1">
              학생이 데이터를 입력하면 여기에 표시됩니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {tableConfig.columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      className={`text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap ${
                        col.sortable ? "cursor-pointer hover:text-purple-600 select-none" : ""
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && sortCol === col.key && (
                          sortAsc ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr
                    key={String(row.id || idx)}
                    className="border-b border-gray-50 hover:bg-purple-50/50 transition-colors"
                  >
                    {tableConfig.columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[250px] truncate"
                      >
                        {col.key === "_student"
                          ? profileMap.get(String(row.user_id)) || "이름없음"
                          : formatCell(col.key, row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              총 {totalCount}건
              {totalPages > 1 &&
                ` 중 ${(page - 1) * PAGE_SIZE + 1}-${Math.min(
                  page * PAGE_SIZE,
                  totalCount
                )}건`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm ${
                        page === pageNum
                          ? "bg-purple-600 text-white"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
