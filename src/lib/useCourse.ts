import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"
import type { CourseResponse } from "./types"

export function useCourse() {
  return useQuery({
    queryKey: ["course"],
    queryFn: () => fetchJson<CourseResponse>("/api/course"),
  })
}
