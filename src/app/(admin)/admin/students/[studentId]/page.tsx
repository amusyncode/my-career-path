"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileUp,
  FileEdit,
  MessageSquareHeart,
  Target,
  FolderOpen,
  Award,
  Flame,
  Clock,
  Map,
  CalendarDays,
  FileText,
  BarChart3,
} from "lucide-react";

import StudentDetailSkeleton from "./_components/StudentDetailSkeleton";
import RoadmapTab from "./_components/RoadmapTab";
import DailyTab from "./_components/DailyTab";
import PortfolioTab from "./_components/PortfolioTab";
import CertificatesTab from "./_components/CertificatesTab";
import DocumentsTab from "./_components/DocumentsTab";
import AnalysisTab from "./_components/AnalysisTab";
import UploadDocumentModal from "./_components/UploadDocumentModal";

type TabKey =
  | "roadmap"
  | "daily"
  | "portfolio"
  | "certificates"
  | "documents"
  | "analytics";

const TABS: { key: TabKey; label: string; icon: typeof Map }[] = [
  { key: "roadmap", label: "로드맵", icon: Map },
  { key: "daily", label: "일일기록", icon: CalendarDays },
  { key: "portfolio", label: "포트폴리오", icon: FolderOpen },
  { key: "certificates", label: "자격증", icon: Award },
  { key: "documents", label: "이력서/자소서", icon: FileText },
  { key: "analytics", label: "분석", icon: BarChart3 },
];

interface SummaryStats {
  inProgressGoals: number;
  projectCount: number;
  certificateCount: number;
  currentStreak: number;
  totalStudyHours: number;
}

export default function AdminStudentDetailPage() {
  const params = useParams();
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
  const [activeTab, setActiveTab] = useState<TabKey>("roadmap");
  const [showUploadModal, setShowUploadModal] = useState<
    "resume" | "cover_letter" | null
  >(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .single();

      if (profileError) throw profileError;
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
        logsRes.data?.reduce((sum, log) => sum + (log.study_hours || 0), 0) ??
        0;

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
  }, [supabase, studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <StudentDetailSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">학생 정보를 찾을 수 없습니다.</p>
        <Link
          href="/admin/students"
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

  const summaryCards = [
    {
      icon: Target,
      label: "진행중 목표",
      value: stats.inProgressGoals,
      unit: "",
    },
    {
      icon: FolderOpen,
      label: "프로젝트",
      value: stats.projectCount,
      unit: "",
    },
    { icon: Award, label: "자격증", value: stats.certificateCount, unit: "" },
    { icon: Flame, label: "연속 학습", value: stats.currentStreak, unit: "일" },
    {
      icon: Clock,
      label: "총 학습시간",
      value: stats.totalStudyHours,
      unit: "시간",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href="/admin/students"
        className="text-sm text-gray-500 hover:text-purple-600 flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        학생관리
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">
              {profile.name}
            </h1>
            {infoSegments && (
              <p className="text-gray-500 mt-0.5">{infoSegments}</p>
            )}
            {profile.target_field && (
              <span className="inline-block bg-purple-50 text-purple-700 rounded-full px-3 py-1 text-sm mt-2">
                {profile.target_field}
              </span>
            )}
            {profile.bio && (
              <p className="text-sm text-gray-400 mt-1">{profile.bio}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {format(new Date(profile.created_at), "yyyy.MM.dd")} 가입
            </p>
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
              className="bg-purple-100 text-purple-700 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-purple-200 transition-colors"
            >
              <FileEdit className="w-4 h-4" />
              자소서 업로드
            </button>
            <button className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-gray-50 transition-colors text-gray-700">
              <MessageSquareHeart className="w-4 h-4" />
              상담 기록
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-lg shadow-sm p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
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
      <div className="border-b mb-6">
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
                    ? "text-purple-600 border-b-2 border-purple-600 font-medium"
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
      {activeTab === "roadmap" && <RoadmapTab studentId={studentId} />}
      {activeTab === "daily" && <DailyTab studentId={studentId} />}
      {activeTab === "portfolio" && <PortfolioTab studentId={studentId} />}
      {activeTab === "certificates" && (
        <CertificatesTab studentId={studentId} />
      )}
      {activeTab === "documents" && <DocumentsTab studentId={studentId} />}
      {activeTab === "analytics" && <AnalysisTab studentId={studentId} />}

      {/* Upload modal */}
      {showUploadModal && (
        <UploadDocumentModal
          studentId={studentId}
          studentName={profile.name}
          documentType={showUploadModal}
          onClose={() => setShowUploadModal(null)}
          onUpload={() => {
            setShowUploadModal(null);
            if (activeTab === "documents") fetchData();
          }}
        />
      )}
    </div>
  );
}
