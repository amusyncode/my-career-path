"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Award } from "lucide-react";
import { format } from "date-fns";
import type { Certificate, CertificateType } from "@/lib/types";

interface CertificatesTabProps {
  studentId: string;
}

const TYPE_ICONS: Record<CertificateType, string> = {
  certificate: "\uD83C\uDFC6",
  award: "\uD83C\uDF96\uFE0F",
  completion: "\uD83D\uDCDC",
};

export default function CertificatesTab({ studentId }: CertificatesTabProps) {
  const supabase = createClient();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCertificates = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", studentId)
        .order("acquired_date", { ascending: false });

      if (error) throw error;
      setCertificates((data as Certificate[]) ?? []);
    } catch (err) {
      console.error("자격증 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-4 flex items-start gap-4 animate-pulse"
          >
            <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/4 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-1/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          등록된 자격증이 없습니다
        </h3>
        <p className="text-gray-500 text-sm">
          학생이 자격증을 등록하면 여기에 표시됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {certificates.map((cert) => {
        const icon = TYPE_ICONS[cert.type] ?? TYPE_ICONS.certificate;

        return (
          <div
            key={cert.id}
            className="bg-gray-50 rounded-lg p-4 flex items-start gap-4"
          >
            {/* Type icon */}
            <span className="text-2xl flex-shrink-0">{icon}</span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900">{cert.name}</h4>

              {cert.issuer && (
                <p className="text-sm text-gray-500">{cert.issuer}</p>
              )}

              {cert.acquired_date && (
                <p className="text-xs text-gray-400">
                  {format(new Date(cert.acquired_date), "yyyy.MM.dd")}
                </p>
              )}

              {cert.score && (
                <p className="text-sm text-purple-600 font-medium mt-1">
                  {cert.score}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
