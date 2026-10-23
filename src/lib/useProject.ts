import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"
import type { ProjectResponse } from "./types"

export function useProject() {
  return useQuery({
    queryKey: ["project"],
    queryFn: () => fetchJson<ProjectResponse>("/api/project"),
    staleTime: 0,
    refetchOnMount: "always",
  })
}
