import { Routes, Route } from "react-router-dom"
import { AppShell } from "./AppShell"
import { CoursesHome } from "../features/courses/CoursesHome"
import { CoursePage } from "../features/course/CoursePage"
import { LessonPage } from "../features/lesson/LessonPage"
import { ChapterQuizPage } from "../features/chapter/ChapterQuizPage"
import { PerformancePage } from "../features/performance/PerformancePage"
import { SettingsPage } from "../features/settings/SettingsPage"
import { NotFound } from "./NotFound"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CoursesHome />} />
        <Route path="courses/:courseId" element={<CoursePage />} />
        <Route path="courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
        <Route path="courses/:courseId/chapters/:chapterId/quiz" element={<ChapterQuizPage />} />
        <Route path="lessons/:lessonId" element={<LessonPage />} />
        <Route path="chapters/:chapterId/quiz" element={<ChapterQuizPage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
