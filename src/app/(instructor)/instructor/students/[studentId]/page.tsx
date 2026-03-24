"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Profile, EducationLevel } from "@/lib/types";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileUp,
  FileEdit,
  MessageSquareHeart,
  Edit3,
  Target,
  FolderOpen,
  Award,
  Flame,
  Clock,
  Map,
  CalendarDays,
  FileText,
  BarChart3,
  Mail,
  Link as LinkIcon,
  Loader2,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";

import EditStudentModal from "@/components/instructor/EditStudentModal";
import UploadDocumentModal from "@/components/instructor/UploadDocumentModal";
import DocumentsTab from "./_components/DocumentsTab";
import RoadmapTab from "./_components/RoadmapTab";
import DailyTab from "./_components/DailyTab";
import PortfolioTab from "./_components/PortfolioTab";
import CertificatesTab from "./_components/CertificatesTab";
import AnalysisTab from "./_components/AnalysisTab";

type TabKey =
  | "documents"
  | "roadmap"
  | "daily"
  | "portfolio"
  | "certificates"
  | "analytics";

const TABS: { key: TabKey; label: string; icon: typeof Map }[] = [
  { key: "documents", label: "이력서/자소서", icon: FileText },
  { key: "roadmap", label: "로드맵", icon: Map },
  { key: "daily", label: "일일기록", icon: CalendarDays },
  { key: "portfolio", label: "포트폴리오", icon: FolderOpen },
  { key: "certificates", label: "자격증", icon: Award },
  { key: "analytics", label: "분석", icon: BarChart3 },
];

interface SummaryStats {
  inProgressGoals: number;
  projectCount: number;
  certificateCount: number;
  currentStreak: number;
  totalStudyHours: number;
}

export default function InstructorStudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<SummaryStats>({
    inProgressGoals: 0,
    projectCount: 0,
    certificateCount: 0,
    currentStreak: 0,
    totalStudyHours: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [showUploadModal, setShowUploadModal] = useState<
    "resume" | "cover_letter" | null
  >(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [instructorInviteCode, setInstructorInviteCode] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch instructor's invite_code
      const { data: instrProfile } = await supabase
        .from("profiles")
        .select("invite_code")
        .eq("id", user.id)
        .single();
      if (instrProfile?.invite_code) {
        setInstructorInviteCode(instrProfile.invite_code);
      }

      // Fetch profile with instructor_id check
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .eq("instructor_id", user.id)
        .single();

      if (profileError || !profileData) {
        toast.error("접근 권한이 없습니다.");
        router.push("/instructor/students");
        return;
      }

      setProfile(profileData as Profile);

      // Fetch summary stats in parallel
      const [goalsRes, projectsRes, certsRes, streaksRes, logsRes] =
        await Promise.all([
          supabase
            .from("roadmap_goals")
            .select("id", { count: "exact", head: true })
            .eq("user_id", studentId)
            .eq("status", "in_progress"),
          supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("user_id", studentId),
          supabase
            .from("certificates")
            .select("id", { count: "exact", head: true })
            .eq("user_id", studentId),
          supabase
            .from("streaks")
            .select("current_streak")
            .eq("user_id", studentId)
            .single(),
          supabase
            .from("daily_logs")
            .select("study_hours")
            .eq("user_id", studentId),
        ]);

      const totalStudyHours =
        logsRes.data?.reduce(
          (sum, log) => sum + (log.study_hours || 0),
          0
        ) ?? 0;

      setStats({
        inProgressGoals: goalsRes.count ?? 0,
        projectCount: projectsRes.count ?? 0,
        certificateCount: certsRes.count ?? 0,
        currentStreak: streaksRes.data?.current_streak ?? 0,
        totalStudyHours,
      });
    } catch (err) {
      console.error("학생 상세 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <StudentDetailSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">
          학생 정보를 찾을 수 없습니다.
        </p>
        <Link
          href="/instructor/students"
          className="text-purple-600 hover:underline mt-2 inline-block"
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

  const infoSegments = [
    profile.school,
    profile.department,
    profile.grade ? `${profile.grade}학년` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const hasAuth = !!profile.email;

  const summaryCards = [
    { icon: Target, label: "진행중 목표", value: stats.inProgressGoals, unit: "" },
    { icon: FolderOpen, label: "프로젝트", value: stats.projectCount, unit: "" },
    { icon: Award, label: "자격증", value: stats.certificateCount, unit: "" },
    { icon: Flame, label: "연속 학습", value: stats.currentStreak, unit: "일" },
    { icon: Clock, label: "총 학습시간", value: stats.totalStudyHours, unit: "시간" },
  ];

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href="/instructor/students"
        className="text-sm text-gray-500 hover:text-purple-600 flex items-center gap-1 transition-colors dark:text-gray-400"
      >
        <ArrowLeft className="w-4 h-4" />
        학생관리
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm p-6 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-2xl font-bold flex-shrink-0 dark:bg-purple-900/30 dark:text-purple-300">
              {initials}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {profile.name}
            </h1>
            {infoSegments && (
              <p className="text-gray-500 mt-0.5 dark:text-gray-400">
                {infoSegments}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {profile.education_level === "high_school" ? (
                <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full dark:bg-purple-900/30 dark:text-purple-300">
                  특성화고
                </span>
              ) : (
                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                  대학교
                </span>
              )}
              {profile.target_field && (
                <span className="bg-purple-50 text-purple-700 rounded-full px-3 py-1 text-sm dark:bg-purple-900/30 dark:text-purple-300">
                  {profile.target_field}
                </span>
              )}
            </div>
            {profile.student_email && (
              <p className="text-sm text-gray-400 mt-1">
                {profile.student_email}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-gray-400">
                {format(new Date(profile.created_at), "yyyy.MM.dd")} 등록
              </p>
              {hasAuth ? (
                <span className="text-xs text-green-600">✅ 가입 완료</span>
              ) : (
                <span className="text-xs text-gray-400">⚪ 미가입</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <button
              onClick={() => setShowUploadModal("resume")}
              className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-purple-600 transition-colors"
            >
              <FileUp className="w-4 h-4" />
              이력서 업로드
            </button>
            <button
              onClick={() => setShowUploadModal("cover_letter")}
              className="bg-purple-100 text-purple-700 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-purple-200 transition-colors dark:bg-purple-900/30 dark:text-purple-300"
            >
              <FileEdit className="w-4 h-4" />
              자소서 업로드
            </button>
            <button className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-gray-50 transition-colors text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
              <MessageSquareHeart className="w-4 h-4" />
              상담 기록
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-gray-50 transition-colors text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <Edit3 className="w-4 h-4" />
              학생 정보 수정
            </button>
            {!hasAuth && (
              <div className="flex gap-2 items-center">
                {profile.student_email && (
                  <button
                    disabled={isSendingInvite}
                    onClick={async () => {
                      setIsSendingInvite(true);
                      try {
                        const res = await fetch("/api/email/send-invite", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ studentId }),
                        });
                        if (res.ok) {
                          toast.success("초대 이메일을 발송했습니다");
                        } else {
                          const data = await res.json();
                          toast.error(data.error || "발송 실패");
                        }
                      } catch {
                        toast.error("이메일 발송 중 오류");
                      }
                      setIsSendingInvite(false);
                    }}
                    className="bg-purple-500 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1.5 hover:bg-purple-600 transition-colors disabled:opacity-50"
                  >
                    {isSendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    초대 메일 발송
                  </button>
                )}
                {instructorInviteCode && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/signup?invite=${instructorInviteCode}`;
                      navigator.clipboard.writeText(url);
                      setCopiedInviteLink(true);
                      toast.success("초대 링크가 복사되었습니다");
                      setTimeout(() => setCopiedInviteLink(false), 2000);
                    }}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center gap-1.5 hover:bg-gray-50 transition-colors text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    {copiedInviteLink ? <Check className="w-4 h-4 text-green-500" /> : <LinkIcon className="w-4 h-4" />}
                    {copiedInviteLink ? "복사됨" : "초대 링크 복사"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-lg shadow-sm p-4 dark:bg-gray-800"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {card.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {card.value}
                {card.unit && (
                  <span className="text-sm font-normal text-gray-500 ml-0.5">
                    {card.unit}
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tab navigation */}
      <div className="border-b dark:border-gray-700">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 pb-3 px-4 text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? "text-purple-600 border-b-2 border-purple-600 font-medium"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
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
        <DocumentsTab
          studentId={studentId}
          studentEmail={profile.student_email}
          onUploadClick={(type) => setShowUploadModal(type)}
        />
      )}
      {activeTab === "roadmap" && (
        <RoadmapTab studentId={studentId} hasAuth={hasAuth} />
      )}
      {activeTab === "daily" && (
        <DailyTab studentId={studentId} hasAuth={hasAuth} />
      )}
      {activeTab === "portfolio" && (
        <PortfolioTab studentId={studentId} hasAuth={hasAuth} />
      )}
      {activeTab === "certificates" && (
        <CertificatesTab studentId={studentId} hasAuth={hasAuth} />
      )}
      {activeTab === "analytics" && (
        <AnalysisTab studentId={studentId} hasAuth={hasAuth} />
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <UploadDocumentModal
          studentId={studentId}
          studentName={profile.name}
          studentDepartment={profile.department || undefined}
          studentEducationLevel={
            profile.education_level as EducationLevel | undefined
          }
          documentType={showUploadModal}
          onClose={() => setShowUploadModal(null)}
          onUpload={() => {
            setShowUploadModal(null);
            if (activeTab === "documents") fetchData();
          }}
        />
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditStudentModal
          student={profile}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Inline Skeleton
// ============================================
function StudentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />

      <div className="bg-white rounded-xl shadow-sm p-6 dark:bg-gray-800">
        <div className="flex gap-6">
          <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm p-4 dark:bg-gray-800"
          >
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="flex gap-4 border-b pb-3 dark:border-gray-700">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-20 bg-gray-200 rounded animate-pulse"
          />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-6 animate-pulse dark:bg-gray-800"
          >
            <div className="h-4 w-1/4 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-12 bg-gray-100 rounded" />
              <div className="h-12 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
