import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

export function useContentEvents() {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (typeof EventSource === "undefined") return
    const source = new EventSource("/api/events")
    source.addEventListener("course:changed", () => {
      void queryClient.invalidateQueries({ queryKey: ["course"] })
    })
    return () => source.close()
  }, [queryClient])
}
