"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Profile, CounselingRecord } from "@/lib/types";
import {
  ArrowLeft,
  Plus,
  Sparkles,
} from "lucide-react";
import StudentProfileSummary from "../_components/StudentProfileSummary";
import CounselingTimeline from "../_components/CounselingTimeline";
import CounselingRecordModal from "../_components/CounselingRecordModal";
import AICounselingSuggestion from "../_components/AICounselingSuggestion";
import toast from "react-hot-toast";

export default function StudentCounselingDetailPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<CounselingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 통계
  const [stats, setStats] = useState({
    totalRecords: 0,
    completedRecords: 0,
    lastCounselingDate: null as string | null,
  });

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CounselingRecord | null>(null);

  // AI 제안 표시
  const [showAISuggestion, setShowAISuggestion] = useState(false);

  const fetchProfile = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", studentId)
      .single();
    if (data) setProfile(data as Profile);
  }, [supabase, studentId]);

  const fetchRecords = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("counseling_records")
        .select("*")
        .eq("user_id", studentId)
        .order("counseling_date", { ascending: false });

      const items = (data || []) as CounselingRecord[];
      setRecords(items);

      // 통계 계산
      const completed = items.filter((r) => r.is_completed).length;
      const lastDate = items.length > 0 ? items[0].counseling_date : null;
      setStats({
        totalRecords: items.length,
        completedRecords: completed,
        lastCounselingDate: lastDate,
      });
    } catch (err) {
      console.error("상담 기록 조회 실패:", err);
    }
  }, [supabase, studentId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchProfile(), fetchRecords()]);
    setIsLoading(false);
  }, [fetchProfile, fetchRecords]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 완료 토글
  const handleToggleComplete = async (record: CounselingRecord) => {
    try {
      const { error } = await supabase
        .from("counseling_records")
        .update({ is_completed: !record.is_completed })
        .eq("id", record.id);
      if (error) throw error;
      toast.success(record.is_completed ? "미완료로 변경했습니다." : "완료 처리했습니다.");
      fetchRecords();
    } catch {
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  // 삭제
  const handleDelete = async (record: CounselingRecord) => {
    if (!confirm("이 상담 기록을 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase
        .from("counseling_records")
        .delete()
        .eq("id", record.id);
      if (error) throw error;
      toast.success("상담 기록이 삭제되었습니다.");
      fetchRecords();
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  };

  // 수정 모달
  const handleEdit = (record: CounselingRecord) => {
    setEditingRecord(record);
    setShowModal(true);
  };

  // 저장 후
  const handleSave = () => {
    setShowModal(false);
    setEditingRecord(null);
    toast.success("상담 기록이 저장되었습니다.");
    fetchRecords();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-40 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-5 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-48 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-4 pl-8">
              <div className="bg-gray-50 rounded-xl p-5">
                <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-full bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">학생 정보를 찾을 수 없습니다.</p>
        <Link
          href="/admin/counseling"
          className="text-purple-600 hover:text-purple-800 text-sm mt-2 inline-block"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 뒤로가기 */}
      <Link
        href="/admin/counseling"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-purple-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        개별상담도우미
      </Link>

      {/* 학생 프로필 요약 */}
      <StudentProfileSummary profile={profile} stats={stats} />

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            setEditingRecord(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          새 상담 기록 작성
        </button>
        <button
          onClick={() => setShowAISuggestion(!showAISuggestion)}
          className="flex items-center gap-2 bg-white border border-purple-300 text-purple-600 px-4 py-2.5 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium"
        >
          <Sparkles className="w-4 h-4" />
          AI 상담 제안 {showAISuggestion ? "닫기" : "받기"}
        </button>
        <Link
          href={`/admin/students/${studentId}`}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          학생 상세 보기
        </Link>
      </div>

      {/* AI 상담 제안 영역 */}
      {showAISuggestion && (
        <AICounselingSuggestion studentId={studentId} />
      )}

      {/* 상담 타임라인 */}
      <CounselingTimeline
        records={records}
        onEdit={handleEdit}
        onToggleComplete={handleToggleComplete}
        onDelete={handleDelete}
      />

      {/* 상담 기록 모달 */}
      {showModal && (
        <CounselingRecordModal
          mode={editingRecord ? "edit" : "create"}
          record={editingRecord}
          preselectedStudentId={studentId}
          preselectedStudentName={profile.name}
          onClose={() => {
            setShowModal(false);
            setEditingRecord(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
