"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { EducationLevel } from "@/lib/types";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Database,
} from "lucide-react";

interface Props {
  instructorId: string;
}

type TableKey =
  | "profiles"
  | "roadmap_goals"
  | "milestones"
  | "daily_logs"
  | "projects"
  | "certificates"
  | "skills"
  | "uploaded_resumes"
  | "uploaded_cover_letters"
  | "ai_review_results"
  | "counseling_records"
  | "email_logs";

interface TableConfig {
  key: TableKey;
  label: string;
  columns: { key: string; label: string; width?: string }[];
  select: string;
  hasUserId: boolean;
  hasInstructorId: boolean;
  dateField?: string;
}

const TABLE_CONFIGS: TableConfig[] = [
  {
    key: "profiles",
    label: "\ub0b4 \ud559\uc0dd \ud504\ub85c\ud544",
    columns: [
      { key: "name", label: "\uc774\ub984", width: "w-24" },
      { key: "email", label: "\uc774\uba54\uc77c", width: "w-40" },
      { key: "school", label: "\ud559\uad50", width: "w-28" },
      { key: "department", label: "\ud559\uacfc", width: "w-28" },
      { key: "education_level", label: "\ud559\uad50\uae09", width: "w-20" },
      { key: "grade", label: "\ud559\ub144", width: "w-16" },
      { key: "has_auth", label: "\uac00\uc785\uc0c1\ud0dc", width: "w-20" },
      { key: "created_at", label: "\ub4f1\ub85d\uc77c", width: "w-24" },
    ],
    select: "id, name, email, school, department, education_level, grade, created_at",
    hasUserId: false,
    hasInstructorId: true,
    dateField: "created_at",
  },
  {
    key: "roadmap_goals",
    label: "\ub85c\ub4dc\ub9f5 \ubaa9\ud45c",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "title", label: "\ubaa9\ud45c \uc81c\ubaa9", width: "w-40" },
      { key: "category", label: "\uce74\ud14c\uace0\ub9ac", width: "w-24" },
      { key: "status", label: "\uc0c1\ud0dc", width: "w-20" },
      { key: "target_date", label: "\ub9c8\uac10\uc77c", width: "w-24" },
      { key: "created_at", label: "\uc0dd\uc131\uc77c", width: "w-24" },
    ],
    select: "id, user_id, title, category, status, target_date, created_at",
    hasUserId: true,
    hasInstructorId: false,
    dateField: "created_at",
  },
  {
    key: "milestones",
    label: "\ub9c8\uc77c\uc2a4\ud1a4",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "_goal_title", label: "\ubaa9\ud45c", width: "w-32" },
      { key: "title", label: "\ub9c8\uc77c\uc2a4\ud1a4", width: "w-40" },
      { key: "is_completed", label: "\uc644\ub8cc\uc5ec\ubd80", width: "w-20" },
      { key: "created_at", label: "\uc0dd\uc131\uc77c", width: "w-24" },
    ],
    select: "id, goal_id, title, is_completed, target_date, completed_at, order_index",
    hasUserId: false,
    hasInstructorId: false,
  },
  {
    key: "daily_logs",
    label: "\uc77c\uc77c \uae30\ub85d",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "log_date", label: "\ub0a0\uc9dc", width: "w-24" },
      { key: "study_hours", label: "\ud559\uc2b5\uc2dc\uac04", width: "w-20" },
      { key: "mood", label: "\uae30\ubd84", width: "w-16" },
      { key: "daily_goal", label: "\uc77c\uc77c\ubaa9\ud45c", width: "w-40" },
      { key: "reflection", label: "\uba54\ubaa8", width: "w-40" },
    ],
    select: "id, user_id, log_date, study_hours, mood, daily_goal, reflection",
    hasUserId: true,
    hasInstructorId: false,
    dateField: "log_date",
  },
  {
    key: "projects",
    label: "\ud504\ub85c\uc81d\ud2b8",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "title", label: "\ud504\ub85c\uc81d\ud2b8\uba85", width: "w-40" },
      { key: "description", label: "\uc124\uba85", width: "w-40" },
      { key: "tech_stack", label: "\uae30\uc220\uc2a4\ud0dd", width: "w-32" },
      { key: "status", label: "\uc0c1\ud0dc", width: "w-20" },
      { key: "created_at", label: "\uc0dd\uc131\uc77c", width: "w-24" },
    ],
    select: "id, user_id, title, description, tech_stack, status, created_at",
    hasUserId: true,
    hasInstructorId: false,
    dateField: "created_at",
  },
  {
    key: "certificates",
    label: "\uc790\uaca9\uc99d",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "name", label: "\uc790\uaca9\uc99d\uba85", width: "w-40" },
      { key: "issuer", label: "\ubc1c\uae09\uae30\uad00", width: "w-28" },
      { key: "acquired_date", label: "\ucde8\ub4dd\uc77c", width: "w-24" },
      { key: "score", label: "\ub4f1\uae09/\uc810\uc218", width: "w-20" },
    ],
    select: "id, user_id, name, issuer, acquired_date, score",
    hasUserId: true,
    hasInstructorId: false,
    dateField: "acquired_date",
  },
  {
    key: "skills",
    label: "\uc2a4\ud0ac",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "name", label: "\uc2a4\ud0ac\uba85", width: "w-32" },
      { key: "category", label: "\uce74\ud14c\uace0\ub9ac", width: "w-24" },
      { key: "level", label: "\ub808\ubca8", width: "w-16" },
    ],
    select: "id, user_id, name, category, level",
    hasUserId: true,
    hasInstructorId: false,
  },
  {
    key: "uploaded_resumes",
    label: "\uc774\ub825\uc11c",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "_education_level", label: "\ud559\uad50\uae09", width: "w-20" },
      { key: "title", label: "\uc81c\ubaa9", width: "w-32" },
      { key: "file_name", label: "\ud30c\uc77c\uba85", width: "w-32" },
      { key: "file_type", label: "\uc720\ud615", width: "w-16" },
      { key: "status", label: "\uc0c1\ud0dc", width: "w-20" },
      { key: "_score", label: "\uc810\uc218", width: "w-16" },
      { key: "created_at", label: "\uc5c5\ub85c\ub4dc\uc77c", width: "w-24" },
    ],
    select: "id, user_id, title, file_name, file_type, status, ai_review_id, created_at",
    hasUserId: true,
    hasInstructorId: true,
    dateField: "created_at",
  },
  {
    key: "uploaded_cover_letters",
    label: "\uc790\uae30\uc18c\uac1c\uc11c",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "_education_level", label: "\ud559\uad50\uae09", width: "w-20" },
      { key: "title", label: "\uc81c\ubaa9", width: "w-32" },
      { key: "target_company", label: "\uc9c0\uc6d0\uae30\uc5c5", width: "w-28" },
      { key: "status", label: "\uc0c1\ud0dc", width: "w-20" },
      { key: "_score", label: "\uc810\uc218", width: "w-16" },
      { key: "created_at", label: "\uc5c5\ub85c\ub4dc\uc77c", width: "w-24" },
    ],
    select: "id, user_id, title, target_company, status, ai_review_id, created_at",
    hasUserId: true,
    hasInstructorId: true,
    dateField: "created_at",
  },
  {
    key: "ai_review_results",
    label: "AI \ucca8\uc0ad \uacb0\uacfc",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "_education_level", label: "\ud559\uad50\uae09", width: "w-20" },
      { key: "document_type", label: "\ubb38\uc11c\uc720\ud615", width: "w-20" },
      { key: "model_used", label: "Gem", width: "w-28" },
      { key: "score", label: "\uc810\uc218", width: "w-16" },
      { key: "tokens_used", label: "\ud1a0\ud070\uc218", width: "w-20" },
      { key: "processing_time", label: "\ucc98\ub9ac\uc2dc\uac04", width: "w-20" },
      { key: "created_at", label: "\ucc98\ub9ac\uc77c", width: "w-24" },
    ],
    select: "id, user_id, document_type, model_used, score, tokens_used, processing_time, created_at",
    hasUserId: true,
    hasInstructorId: true,
    dateField: "created_at",
  },
  {
    key: "counseling_records",
    label: "\uc0c1\ub2f4 \uae30\ub85d",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "counseling_type", label: "\uc720\ud615", width: "w-20" },
      { key: "title", label: "\uc81c\ubaa9", width: "w-40" },
      { key: "counseling_date", label: "\uc0c1\ub2f4\uc77c", width: "w-24" },
      { key: "is_completed", label: "\uc644\ub8cc\uc5ec\ubd80", width: "w-20" },
      { key: "ai_suggestion", label: "AI\uc81c\uc548", width: "w-16" },
    ],
    select: "id, user_id, counseling_type, title, counseling_date, is_completed, ai_suggestion",
    hasUserId: true,
    hasInstructorId: true,
    dateField: "counseling_date",
  },
  {
    key: "email_logs",
    label: "\uc774\uba54\uc77c \ubc1c\uc1a1 \uc774\ub825",
    columns: [
      { key: "_student_name", label: "\ud559\uc0dd", width: "w-24" },
      { key: "recipient_email", label: "\uc218\uc2e0\uc774\uba54\uc77c", width: "w-36" },
      { key: "content_type", label: "\uc720\ud615", width: "w-20" },
      { key: "subject", label: "\uc81c\ubaa9", width: "w-40" },
      { key: "status", label: "\uc0c1\ud0dc", width: "w-16" },
      { key: "sent_at", label: "\ubc1c\uc1a1\uc77c", width: "w-24" },
    ],
    select: "id, student_id, recipient_email, content_type, subject, status, sent_at",
    hasUserId: false,
    hasInstructorId: true,
    dateField: "sent_at",
  },
];

const PAGE_SIZE = 20;

const CATEGORY_LABELS: Record<string, string> = {
  certificate: "\uc790\uaca9\uc99d", skill: "\uc2a4\ud0ac", project: "\ud504\ub85c\uc81d\ud2b8",
  experience: "\uacbd\ud5d8", education: "\uad50\uc721", other: "\uae30\ud0c0",
};
const STATUS_LABELS: Record<string, string> = {
  planned: "\uacc4\ud68d", in_progress: "\uc9c4\ud589\uc911", completed: "\uc644\ub8cc", paused: "\uc911\ub2e8",
  planning: "\uae30\ud68d", uploaded: "\uc5c5\ub85c\ub4dc", reviewing: "\uac80\ud1a0\uc911", reviewed: "\uc644\ub8cc", failed: "\uc2e4\ud328",
};
const COUNSELING_LABELS: Record<string, string> = {
  career: "\uc9c4\ub85c\uc0c1\ub2f4", resume: "\uc774\ub825\uc11c\uc0c1\ub2f4",
  interview: "\uba74\uc811\uc900\ube44", mental: "\uace0\ucda9\uc0c1\ub2f4", other: "\uae30\ud0c0",
};
const COUNSELING_COLORS: Record<string, string> = {
  career: "bg-blue-100 text-blue-700", resume: "bg-green-100 text-green-700",
  interview: "bg-orange-100 text-orange-700", mental: "bg-pink-100 text-pink-700",
  other: "bg-gray-100 text-gray-700",
};
const EMAIL_STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700", pending: "bg-yellow-100 text-yellow-700",
};

function formatDate(d: string | null): string {
  if (!d) return "-";
  return d.slice(0, 10).replace(/-/g, ".");
}

function truncate(s: string | null, max = 50): string {
  if (!s) return "-";
  return s.length > max ? s.slice(0, max) + "..." : s;
}

export default function DataBrowseTab({ instructorId }: Props) {
  const supabase = createClient();

  const [selectedTable, setSelectedTable] = useState<TableKey>("profiles");
  const [educationFilter, setEducationFilter] = useState<EducationLevel | "">("");
  const [studentFilter, setStudentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Student name map
  const [studentMap, setStudentMap] = useState<Record<string, { name: string; education_level: string }>>({});

  // Fetch student map
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, education_level")
        .eq("instructor_id", instructorId)
        .eq("role", "student");
      const map: Record<string, { name: string; education_level: string }> = {};
      (data || []).forEach((s) => { map[s.id] = { name: s.name, education_level: s.education_level }; });
      setStudentMap(map);
    };
    fetch();
  }, [supabase, instructorId]);

  const config = TABLE_CONFIGS.find((t) => t.key === selectedTable)!;
  const studentIds = Object.keys(studentMap);

  const fetchData = useCallback(async () => {
    if (studentIds.length === 0 && selectedTable !== "profiles") {
      setRows([]);
      setTotalCount(0);
      return;
    }
    setIsLoading(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any;

      if (selectedTable === "profiles") {
        query = supabase.from("profiles").select(config.select, { count: "exact" })
          .eq("instructor_id", instructorId).eq("role", "student");
        if (educationFilter) query = query.eq("education_level", educationFilter);
      } else if (selectedTable === "milestones") {
        // milestones need goal_ids from roadmap_goals
        const { data: goals } = await supabase
          .from("roadmap_goals")
          .select("id, user_id, title")
          .in("user_id", studentIds);
        const goalIds = (goals || []).map(g => g.id);
        if (goalIds.length === 0) { setRows([]); setTotalCount(0); setIsLoading(false); return; }
        query = supabase.from("milestones").select(config.select, { count: "exact" }).in("goal_id", goalIds);
      } else if (selectedTable === "email_logs") {
        query = supabase.from("email_logs").select(config.select, { count: "exact" })
          .eq("instructor_id", instructorId);
        if (studentFilter) query = query.eq("student_id", studentFilter);
      } else if (config.hasInstructorId) {
        query = supabase.from(selectedTable).select(config.select, { count: "exact" })
          .eq("instructor_id", instructorId);
        if (studentFilter) query = query.eq("user_id", studentFilter);
        if (educationFilter && config.hasUserId) {
          const filteredIds = Object.entries(studentMap)
            .filter(([, v]) => v.education_level === educationFilter)
            .map(([id]) => id);
          if (filteredIds.length > 0) query = query.in("user_id", filteredIds);
        }
      } else {
        let targetIds = studentIds;
        if (studentFilter) targetIds = [studentFilter];
        else if (educationFilter) {
          targetIds = Object.entries(studentMap)
            .filter(([, v]) => v.education_level === educationFilter)
            .map(([id]) => id);
        }
        if (targetIds.length === 0) { setRows([]); setTotalCount(0); setIsLoading(false); return; }
        query = supabase.from(selectedTable).select(config.select, { count: "exact" })
          .in("user_id", targetIds);
      }

      // Date filter
      if (config.dateField && dateFrom) {
        query = query.gte(config.dateField, dateFrom);
      }
      if (config.dateField && dateTo) {
        query = query.lte(config.dateField, dateTo + "T23:59:59");
      }

      // Sort
      const orderField = sortKey || config.dateField || "created_at";
      query = query.order(orderField, { ascending: sortAsc });

      // Pagination
      const from = page * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      setRows((data || []) as Record<string, unknown>[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("DataBrowse fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, instructorId, selectedTable, studentFilter, educationFilter, dateFrom, dateTo, page, sortKey, sortAsc, studentIds, studentMap, config]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset on table change
  useEffect(() => {
    setPage(0);
    setSortKey(null);
    setSortAsc(true);
    setSearchQuery("");
  }, [selectedTable]);

  const handleSort = (key: string) => {
    if (key.startsWith("_")) return; // computed fields not sortable
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
    setPage(0);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Filter displayed rows by search
  const displayRows = searchQuery
    ? rows.filter((r) =>
        Object.values(r).some((v) =>
          String(v || "").toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : rows;

  const renderCell = (row: Record<string, unknown>, colKey: string): React.ReactNode => {
    const userId = (row.user_id || row.student_id || row.id) as string;

    if (colKey === "_student_name") return studentMap[userId]?.name || "-";
    if (colKey === "_education_level") {
      const level = studentMap[userId]?.education_level;
      return level === "high_school"
        ? <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{"\ud2b9\uc131\ud654\uace0"}</span>
        : level === "university"
        ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{"\ub300\ud559\uad50"}</span>
        : "-";
    }
    if (colKey === "_score") return "-"; // placeholder, would need review join
    if (colKey === "_goal_title") return "-"; // placeholder

    const val = row[colKey];

    // Education level
    if (colKey === "education_level") {
      return val === "high_school"
        ? <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{"\ud2b9\uc131\ud654\uace0"}</span>
        : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{"\ub300\ud559\uad50"}</span>;
    }

    // has_auth
    if (colKey === "has_auth") {
      return (row as Record<string, unknown>).email ? "\u2705\uac00\uc785" : "\u26aa\ubbf8\uac00\uc785";
    }

    // Dates
    if (colKey.includes("date") || colKey.includes("_at") || colKey === "sent_at") {
      return formatDate(val as string | null);
    }

    // Boolean
    if (colKey === "is_completed") {
      return val ? <span className="text-green-600">{"\u2705 \uc644\ub8cc"}</span> : <span className="text-gray-400">{"\u26aa \ubbf8\uc644\ub8cc"}</span>;
    }

    // Counseling type
    if (colKey === "counseling_type") {
      const type = val as string;
      return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COUNSELING_COLORS[type] || ""}`}>{COUNSELING_LABELS[type] || type}</span>;
    }

    // Email status
    if (colKey === "status" && selectedTable === "email_logs") {
      const status = val as string;
      return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EMAIL_STATUS_COLORS[status] || ""}`}>{status}</span>;
    }

    // Document status
    if (colKey === "status" && (selectedTable === "uploaded_resumes" || selectedTable === "uploaded_cover_letters")) {
      return <span className="text-xs">{STATUS_LABELS[val as string] || String(val)}</span>;
    }

    // Category
    if (colKey === "category" && selectedTable === "roadmap_goals") {
      return CATEGORY_LABELS[val as string] || String(val);
    }

    // Status
    if (colKey === "status") {
      return STATUS_LABELS[val as string] || String(val);
    }

    // Document type
    if (colKey === "document_type") {
      return val === "resume" ? "\uc774\ub825\uc11c" : "\uc790\uc18c\uc11c";
    }

    // Content type (email)
    if (colKey === "content_type") {
      const m: Record<string, string> = { ai_review: "AI\ucca8\uc0ad", counseling: "\uc0c1\ub2f4", suggestion: "AI\uc81c\uc548", custom: "\ucee4\uc2a4\ud140" };
      return m[val as string] || String(val);
    }

    // AI suggestion
    if (colKey === "ai_suggestion") {
      return val ? "\u2705" : "-";
    }

    // Processing time
    if (colKey === "processing_time") {
      return val ? `${((val as number) / 1000).toFixed(1)}\ucd08` : "-";
    }

    // Tokens
    if (colKey === "tokens_used") {
      return val ? (val as number).toLocaleString() : "-";
    }

    // Score
    if (colKey === "score") {
      const s = val as number | null;
      if (s == null) return "-";
      const color = s >= 71 ? "text-green-600" : s >= 41 ? "text-yellow-600" : "text-red-600";
      return <span className={`font-bold ${color}`}>{s}</span>;
    }

    // Tech stack (array)
    if (colKey === "tech_stack" && Array.isArray(val)) {
      return val.slice(0, 3).join(", ") + (val.length > 3 ? "..." : "");
    }

    // Mood
    if (colKey === "mood") {
      const moods = ["", "\ud83d\ude22", "\ud83d\ude15", "\ud83d\ude10", "\ud83d\ude42", "\ud83d\ude04"];
      return moods[val as number] || String(val);
    }

    // Study hours
    if (colKey === "study_hours") {
      return val != null ? `${String(val)}h` : "-";
    }

    // Grade
    if (colKey === "grade") {
      return val != null ? `${String(val)}\ud559\ub144` : "-";
    }

    // Level (skill)
    if (colKey === "level") {
      const stars = "\u2605".repeat(val as number) + "\u2606".repeat(5 - (val as number));
      return <span className="text-yellow-500 text-xs">{stars}</span>;
    }

    return <span title={String(val || "")}>{truncate(String(val || ""), 50)}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex flex-wrap gap-3 flex-1">
            {/* Table select */}
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value as TableKey)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {TABLE_CONFIGS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>

            {/* Student filter */}
            <select
              value={studentFilter}
              onChange={(e) => { setStudentFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none max-w-[200px]"
            >
              <option value="">{"\uc804\uccb4 \ud559\uc0dd"}</option>
              {Object.entries(studentMap).map(([id, s]) => (
                <option key={id} value={id}>{s.name}</option>
              ))}
            </select>

            {/* Education level */}
            <select
              value={educationFilter}
              onChange={(e) => { setEducationFilter(e.target.value as EducationLevel | ""); setPage(0); }}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              <option value="">{"\uc804\uccb4 \ud559\uad50\uae09"}</option>
              <option value="high_school">{"\ud2b9\uc131\ud654\uace0"}</option>
              <option value="university">{"\ub300\ud559\uad50"}</option>
            </select>

            {/* Date range */}
            {config.dateField && (
              <div className="flex items-center gap-2">
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                  className="px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                <span className="text-gray-400 text-sm">~</span>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                  className="px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={"\ub370\uc774\ud130 \uac80\uc0c9..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none w-full lg:w-56"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : displayRows.length === 0 ? (
          <div className="text-center py-20">
            <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">{"\uc120\ud0dd\ud55c \ud14c\uc774\ube14\uc5d0 \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  {config.columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50 dark:bg-gray-900 ${
                        col.width || ""
                      } ${!col.key.startsWith("_") ? "cursor-pointer hover:text-purple-600" : ""}`}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && (
                          sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {displayRows.map((row, i) => (
                  <tr key={i} className="hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors">
                    {config.columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {renderCell(row, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">{"\ucd1d"} {totalCount}{"\uac74"}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
