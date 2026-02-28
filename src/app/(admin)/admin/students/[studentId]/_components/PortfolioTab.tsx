"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { FolderOpen, ExternalLink, Github } from "lucide-react";
import type { Project, ProjectStatus } from "@/lib/types";

interface PortfolioTabProps {
  studentId: string;
}

const STATUS_BADGE: Record<
  ProjectStatus,
  { bg: string; text: string; label: string }
> = {
  planning: { bg: "bg-gray-100", text: "text-gray-600", label: "기획중" },
  in_progress: { bg: "bg-blue-50", text: "text-blue-700", label: "진행중" },
  completed: { bg: "bg-green-50", text: "text-green-700", label: "완료" },
};

export default function PortfolioTab({ studentId }: PortfolioTabProps) {
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
            <div className="h-32 bg-gray-200 rounded-lg mb-3" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-full mb-2" />
            <div className="flex gap-1 mt-2">
              <div className="h-5 bg-gray-100 rounded-full w-14" />
              <div className="h-5 bg-gray-100 rounded-full w-16" />
              <div className="h-5 bg-gray-100 rounded-full w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          등록된 프로젝트가 없습니다
        </h3>
        <p className="text-gray-500 text-sm">
          학생이 프로젝트를 등록하면 여기에 표시됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map((project) => {
        const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.planning;

        return (
          <div
            key={project.id}
            className="bg-gray-50 rounded-lg p-4"
          >
            {/* Thumbnail */}
            {project.thumbnail_url && (
              <img
                src={project.thumbnail_url}
                alt={project.title}
                className="h-32 w-full object-cover rounded-lg mb-3"
              />
            )}

            {/* Title */}
            <h4 className="font-medium text-gray-900">{project.title}</h4>

            {/* Description */}
            {project.description && (
              <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                {project.description}
              </p>
            )}

            {/* Tech stack tags */}
            {project.tech_stack && project.tech_stack.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {project.tech_stack.map((tech) => (
                  <span
                    key={tech}
                    className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {/* Bottom: status badge + links */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
              <span
                className={`text-xs rounded-full px-2 py-0.5 ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>

              <div className="flex items-center gap-2">
                {project.github_url && (
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                    title="GitHub"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                )}
                {project.demo_url && (
                  <a
                    href={project.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                    title="Demo"
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
