import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"

export interface TaskFilesResponse {
  files: Array<{ name: string; content: string }>
  starterFiles: Array<{ name: string; content: string }>
  kind: "code" | "terminal" | "love" | "project"
}

export function useTaskFiles(lessonId: string, taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-files", lessonId, taskId],
    queryFn: () => fetchJson<TaskFilesResponse>(`/api/tasks/${lessonId}/${taskId}/files`),
    enabled: Boolean(lessonId && taskId),
  })
}

export async function saveTaskFiles(
  lessonId: string,
  taskId: string,
  files: Array<{ name: string; content: string }>,
) {
  return fetchJson<{ files: Array<{ name: string; content: string }> }>(
    `/api/tasks/${lessonId}/${taskId}/files`,
    { method: "PUT", body: JSON.stringify({ files }) },
  )
}

export async function resetTaskFiles(lessonId: string, taskId: string) {
  return fetchJson<{ files: Array<{ name: string; content: string }> }>(
    `/api/tasks/${lessonId}/${taskId}/reset`,
    { method: "POST" },
  )
}
