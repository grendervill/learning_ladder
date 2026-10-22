import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"
import type { CoursesResponse } from "./types"

export function useCourses(query = "", page = 1) {
  return useQuery({
    queryKey: ["courses", query, page],
    queryFn: () =>
      fetchJson<CoursesResponse>(
        `/api/courses?query=${encodeURIComponent(query)}&page=${page}`,
      ),
    staleTime: 0,
    refetchOnMount: "always",
  })
}
