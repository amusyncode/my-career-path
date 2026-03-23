"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Award, Medal, GraduationCap } from "lucide-react";
import { format } from "date-fns";

interface Certificate {
  id: string;
  name: string;
  type: string;
  issuer: string | null;
  acquired_date: string | null;
  score: string | null;
}

interface CertificatesTabProps {
  studentId: string;
  hasAuth?: boolean;
}

const TYPE_ICON: Record<string, typeof Award> = {
  certificate: Award,
  award: Medal,
  completion: GraduationCap,
};

export default function CertificatesTab({ studentId, hasAuth }: CertificatesTabProps) {
  const supabase = createClient();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", studentId)
        .order("acquired_date", { ascending: false });

      if (error) throw error;
      setCerts((data as Certificate[]) ?? []);
    } catch (err) {
      console.error("자격증 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchCerts();
  }, [fetchCerts]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse dark:bg-gray-800">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (hasAuth === false) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          이 학생은 아직 가입하지 않아 자격증 데이터가 없습니다
        </p>
      </div>
    );
  }

  if (certs.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
          등록된 자격증이 없습니다
        </h3>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm dark:bg-gray-800">
      <div className="divide-y dark:divide-gray-700">
        {certs.map((cert) => {
          const Icon = TYPE_ICON[cert.type] ?? Award;

          return (
            <div key={cert.id} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0 dark:bg-purple-900/30">
                <Icon className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 dark:text-white">
                  {cert.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  {cert.issuer && <span>{cert.issuer}</span>}
                  {cert.acquired_date && (
                    <>
                      <span>·</span>
                      <span>
                        {format(new Date(cert.acquired_date), "yyyy.MM.dd")}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {cert.score && (
                <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 dark:bg-purple-900/30 dark:text-purple-300">
                  {cert.score}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
