import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { fetchJson } from "./api"
import type { CourseDetailResponse, CourseResponse } from "./types"

function toCourseResponse(detail: CourseDetailResponse): CourseResponse {
  return {
    version: "",
    course: detail.course,
    progress: detail.progress,
    chapters: detail.chapters,
    lessons: detail.lessons,
    unassigned: detail.unassigned,
    errors: detail.errors,
    access: detail.access,
    currentSession: null,
  }
}

export function useCourse(courseId?: string): UseQueryResult<CourseResponse> {
  const detail = useQuery({
    queryKey: ["course", courseId ?? "detail"],
    queryFn: () => fetchJson<CourseDetailResponse>(`/api/courses/${encodeURIComponent(courseId ?? "")}`),
    enabled: Boolean(courseId),
    staleTime: 0,
    refetchOnMount: "always",
  })
  const legacy = useQuery({
    queryKey: ["course", "legacy"],
    queryFn: () => fetchJson<CourseResponse>("/api/course"),
    enabled: !courseId,
    staleTime: 0,
    refetchOnMount: "always",
  })
  const active = courseId ? detail : legacy
  return {
    ...active,
    data: courseId ? (detail.data ? toCourseResponse(detail.data) : undefined) : legacy.data,
  } as UseQueryResult<CourseResponse>
}
