import { Routes, Route } from "react-router-dom"
import { AppShell } from "./AppShell"
import { CourseHome } from "../features/course/CourseHome"
import { LessonPlaceholder } from "../features/lesson/LessonPlaceholder"
import { PerformancePlaceholder } from "../features/performance/PerformancePlaceholder"
import { NotFound } from "./NotFound"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CourseHome />} />
        <Route path="lessons/:lessonId" element={<LessonPlaceholder />} />
        <Route path="performance" element={<PerformancePlaceholder />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
