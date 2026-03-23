"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type {
  Profile,
  UploadedResume,
  UploadedCoverLetter,
  AIReviewResult,
  CounselingRecord,
  EducationLevel,
} from "@/lib/types";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileText,
  Sparkles,
  MessageSquareHeart,
  FileUp,
  FileEdit,
  UserCog,
  Pencil,
  Save,
  X,
  Loader2,
} from "lucide-react";
import ChangeInstructorModal from "@/components/admin/ChangeInstructorModal";
import StudentDetailSkeleton from "./_components/StudentDetailSkeleton";
import UploadDocumentModal from "./_components/UploadDocumentModal";
import toast from "react-hot-toast";

type TabKey = "documents" | "ai_reviews" | "counseling";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  uploaded: { label: "업로드됨", color: "bg-gray-100 text-gray-700" },
  reviewing: { label: "검토중", color: "bg-yellow-100 text-yellow-700" },
  reviewed: { label: "검토완료", color: "bg-green-100 text-green-700" },
  failed: { label: "실패", color: "bg-red-100 text-red-700" },
};

const EDUCATION_LABELS: Record<EducationLevel, string> = {
  high_school: "특성화고",
  university: "대학생",
};

export default function AdminStudentDetailPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [instructorName, setInstructorName] = useState<string>("-");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("documents");

  // Stats
  const [stats, setStats] = useState({
    resumeCount: 0,
    coverLetterCount: 0,
    aiReviewCount: 0,
    counselingCount: 0,
  });

  // Tab data
  const [resumes, setResumes] = useState<UploadedResume[]>([]);
  const [coverLetters, setCoverLetters] = useState<UploadedCoverLetter[]>([]);
  const [aiReviews, setAiReviews] = useState<AIReviewResult[]>([]);
  const [counselingRecords, setCounselingRecords] = useState<CounselingRecord[]>([]);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    school: "",
    department: "",
    grade: "",
    education_level: "high_school" as EducationLevel,
    target_field: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [showChangeInstructor, setShowChangeInstructor] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState<"resume" | "cover_letter" | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .single();

      if (profileError) throw profileError;
      const p = profileData as Profile;
      setProfile(p);
      setEditForm({
        name: p.name || "",
        school: p.school || "",
        department: p.department || "",
        grade: p.grade ? String(p.grade) : "",
        education_level: p.education_level,
        target_field: p.target_field || "",
      });

      // Instructor name
      if (p.instructor_id) {
        const { data: instrData } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", p.instructor_id)
          .single();
        if (instrData) setInstructorName(instrData.name);
      }

      // Stats + Tab data in parallel
      const [resumeRes, coverRes, reviewRes, counselRes] = await Promise.all([
        supabase
          .from("uploaded_resumes")
          .select("*")
          .eq("user_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("uploaded_cover_letters")
          .select("*")
          .eq("user_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("ai_review_results")
          .select("*")
          .eq("user_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("counseling_records")
          .select("*")
          .eq("user_id", studentId)
          .order("counseling_date", { ascending: false }),
      ]);

      setResumes((resumeRes.data || []) as UploadedResume[]);
      setCoverLetters((coverRes.data || []) as UploadedCoverLetter[]);
      setAiReviews((reviewRes.data || []) as AIReviewResult[]);
      setCounselingRecords((counselRes.data || []) as CounselingRecord[]);

      setStats({
        resumeCount: resumeRes.data?.length ?? 0,
        coverLetterCount: coverRes.data?.length ?? 0,
        aiReviewCount: reviewRes.data?.length ?? 0,
        counselingCount: counselRes.data?.length ?? 0,
      });
    } catch (err) {
      console.error("학생 상세 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/update-student", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          updates: {
            name: editForm.name.trim(),
            school: editForm.school.trim() || null,
            department: editForm.department.trim() || null,
            grade: editForm.grade ? parseInt(editForm.grade) : null,
            education_level: editForm.education_level,
            target_field: editForm.target_field.trim() || null,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("학생 정보가 수정되었습니다.");
        setIsEditing(false);
        fetchData();
      } else {
        toast.error(data.error || "수정 실패");
      }
    } catch {
      toast.error("학생 정보 수정 중 오류가 발생했습니다.");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return <StudentDetailSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">학생 정보를 찾을 수 없습니다.</p>
        <Link
          href="/admin/students"
          className="text-red-600 hover:underline mt-2 inline-block"
        >
          학생 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const initials = profile.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const statCards = [
    { label: "이력서수", value: stats.resumeCount, color: "text-blue-600" },
    { label: "자소서수", value: stats.coverLetterCount, color: "text-green-600" },
    { label: "AI 첨삭수", value: stats.aiReviewCount, color: "text-purple-600" },
    { label: "상담 기록수", value: stats.counselingCount, color: "text-amber-600" },
  ];

  const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
    { key: "documents", label: "이력서/자소서", icon: FileText },
    { key: "ai_reviews", label: "AI 리뷰", icon: Sparkles },
    { key: "counseling", label: "상담 기록", icon: MessageSquareHeart },
  ];

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href="/admin/students"
        className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        전체 학생
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
          )}

          {/* Info / Edit */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3 max-w-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">이름</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">학교</label>
                    <input
                      type="text"
                      value={editForm.school}
                      onChange={(e) =>
                        setEditForm({ ...editForm, school: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">학과</label>
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={(e) =>
                        setEditForm({ ...editForm, department: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">학년</label>
                    <select
                      value={editForm.grade}
                      onChange={(e) =>
                        setEditForm({ ...editForm, grade: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">미지정</option>
                      <option value="1">1학년</option>
                      <option value="2">2학년</option>
                      <option value="3">3학년</option>
                      <option value="4">4학년</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">학교급</label>
                    <select
                      value={editForm.education_level}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          education_level: e.target.value as EducationLevel,
                        })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="high_school">특성화고</option>
                      <option value="university">대학생</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">희망 분야</label>
                    <input
                      type="text"
                      value={editForm.target_field}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          target_field: e.target.value,
                        })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-red-500 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-red-600 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    저장
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-gray-50"
                  >
                    <X className="w-4 h-4" />
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profile.name}
                  </h1>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      profile.education_level === "high_school"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {EDUCATION_LABELS[profile.education_level]}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-0.5">
                  {profile.email}
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  {[
                    profile.school,
                    profile.department,
                    profile.grade ? `${profile.grade}학년` : null,
                  ]
                    .filter(Boolean)
                    .join(" | ") || "학교 정보 미등록"}
                </p>
                {profile.target_field && (
                  <span className="inline-block bg-red-50 text-red-700 rounded-full px-3 py-1 text-sm mt-2">
                    {profile.target_field}
                  </span>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  담당 강사:{" "}
                  {profile.instructor_id ? (
                    <Link
                      href={`/admin/instructors/${profile.instructor_id}`}
                      className="text-red-600 hover:underline"
                    >
                      {instructorName}
                    </Link>
                  ) : (
                    <span className="text-gray-400">미배정</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {format(new Date(profile.created_at), "yyyy.MM.dd")} 가입
                </p>
              </>
            )}
          </div>

          {/* Action buttons */}
          {!isEditing && (
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <button
                onClick={() => setIsEditing(true)}
                className="bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                정보 수정
              </button>
              <button
                onClick={() => setShowChangeInstructor(true)}
                className="bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
              >
                <UserCog className="w-4 h-4" />
                담당 강사 변경
              </button>
              <button
                onClick={() => setShowUploadModal("resume")}
                className="bg-red-500 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-red-600 transition-colors"
              >
                <FileUp className="w-4 h-4" />
                이력서 업로드
              </button>
              <button
                onClick={() => setShowUploadModal("cover_letter")}
                className="bg-red-100 text-red-700 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-red-200 transition-colors"
              >
                <FileEdit className="w-4 h-4" />
                자소서 업로드
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-lg shadow-sm p-4"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="border-b">
        <div className="flex gap-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 pb-3 px-4 text-sm transition-colors ${
                  isActive
                    ? "text-red-600 border-b-2 border-red-600 font-medium"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          {/* Resumes */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              이력서 ({stats.resumeCount})
            </h3>
            {resumes.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white rounded-lg p-6 text-center">
                업로드된 이력서가 없습니다.
              </p>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        제목
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        파일명
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">
                        상태
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        업로드일
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resumes.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {r.title}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {r.file_name}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_LABELS[r.status]?.color || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {STATUS_LABELS[r.status]?.label || r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {format(new Date(r.created_at), "yyyy.MM.dd")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cover Letters */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              자기소개서 ({stats.coverLetterCount})
            </h3>
            {coverLetters.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white rounded-lg p-6 text-center">
                업로드된 자기소개서가 없습니다.
              </p>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        제목
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        지원회사
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">
                        상태
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        업로드일
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {coverLetters.map((cl) => (
                      <tr key={cl.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {cl.title}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {cl.target_company || "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_LABELS[cl.status]?.color || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {STATUS_LABELS[cl.status]?.label || cl.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {format(new Date(cl.created_at), "yyyy.MM.dd")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "ai_reviews" && (
        <div>
          {aiReviews.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-lg p-6 text-center">
              AI 리뷰 기록이 없습니다.
            </p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      유형
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">
                      점수
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      피드백
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      모델
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      날짜
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {aiReviews.map((review) => (
                    <tr key={review.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            review.document_type === "resume"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {review.document_type === "resume"
                            ? "이력서"
                            : "자소서"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-gray-900">
                          {review.score ?? review.overall_score ?? "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                        {review.feedback || review.reviewer_comment || "-"}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {review.model_used || review.model_name || "-"}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {format(new Date(review.created_at), "yyyy.MM.dd")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "counseling" && (
        <div>
          {counselingRecords.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-lg p-6 text-center">
              상담 기록이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {counselingRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-xl shadow-sm p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {record.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {record.counseling_type === "career"
                            ? "진로"
                            : record.counseling_type === "resume"
                            ? "이력서"
                            : record.counseling_type === "interview"
                            ? "면접"
                            : record.counseling_type === "mental"
                            ? "심리"
                            : "기타"}
                        </span>
                        {record.is_completed && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            완료
                          </span>
                        )}
                      </div>
                      {record.content && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {record.content}
                        </p>
                      )}
                      {record.action_items && (
                        <p className="text-sm text-gray-500 mt-1">
                          <span className="font-medium">실행 항목:</span>{" "}
                          {record.action_items}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-gray-400 flex-shrink-0">
                      {format(
                        new Date(record.counseling_date),
                        "yyyy.MM.dd"
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Change Instructor Modal */}
      {showChangeInstructor && (
        <ChangeInstructorModal
          isOpen={true}
          onClose={() => setShowChangeInstructor(false)}
          studentId={studentId}
          studentName={profile.name}
          currentInstructorId={profile.instructor_id}
          onSuccess={fetchData}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadDocumentModal
          studentId={studentId}
          studentName={profile.name}
          documentType={showUploadModal}
          onClose={() => setShowUploadModal(null)}
          onUpload={() => {
            setShowUploadModal(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
