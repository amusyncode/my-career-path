"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { FolderOpen, ExternalLink, Github } from "lucide-react";

interface Project {
  id: string;
  title: string;
  description: string | null;
  tech_stack: string[];
  status: string;
  thumbnail_url: string | null;
  github_url: string | null;
  demo_url: string | null;
}

interface PortfolioTabProps {
  studentId: string;
  hasAuth?: boolean;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  planning: { label: "기획중", className: "bg-gray-100 text-gray-600" },
  in_progress: { label: "진행중", className: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", className: "bg-green-100 text-green-700" },
};

export default function PortfolioTab({ studentId, hasAuth }: PortfolioTabProps) {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects((data as Project[]) ?? []);
    } catch (err) {
      console.error("프로젝트 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse dark:bg-gray-800">
            <div className="h-32 bg-gray-100 rounded mb-3" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (hasAuth === false) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          이 학생은 아직 가입하지 않아 포트폴리오 데이터가 없습니다
        </p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
          등록된 프로젝트가 없습니다
        </h3>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {projects.map((project) => {
        const statusConf = STATUS_LABEL[project.status] ?? STATUS_LABEL.planning;

        return (
          <div
            key={project.id}
            className="bg-white rounded-xl shadow-sm overflow-hidden dark:bg-gray-800"
          >
            {project.thumbnail_url && (
              <img
                src={project.thumbnail_url}
                alt={project.title}
                className="w-full h-40 object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {project.title}
                </h4>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusConf.className}`}
                >
                  {statusConf.label}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-3 dark:text-gray-400">
                  {project.description}
                </p>
              )}
              {project.tech_stack && project.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {project.tech_stack.map((tech) => (
                    <span
                      key={tech}
                      className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded dark:bg-purple-900/30 dark:text-purple-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {project.github_url && (
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                )}
                {project.demo_url && (
                  <a
                    href={project.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
