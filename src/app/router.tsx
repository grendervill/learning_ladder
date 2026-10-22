import { Routes, Route } from "react-router-dom"
import { AppShell } from "./AppShell"
import { CourseHome } from "../features/course/CourseHome"
import { LessonPage } from "../features/lesson/LessonPage"
import { ChapterQuizPage } from "../features/chapter/ChapterQuizPage"
import { PerformancePage } from "../features/performance/PerformancePage"
import { SettingsPage } from "../features/settings/SettingsPage"
import { NotFound } from "./NotFound"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CourseHome />} />
        <Route path="lessons/:lessonId" element={<LessonPage />} />
        <Route path="chapters/:chapterId/quiz" element={<ChapterQuizPage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
