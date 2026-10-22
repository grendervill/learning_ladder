import type { CourseResponse } from "../../lib/types"
import type { ProgressResponse } from "../../lib/useProgress"

export function GradeTable({
  course,
  progress,
}: {
  course: CourseResponse
  progress: ProgressResponse
}) {
  return (
    <div className="grade-table">
      {course.chapters.map((chapter) => {
        const chapterProgress = progress.chapters[chapter.id]
        return (
          <div className="grade-chapter" key={chapter.id}>
            <div className="grade-chapter__head">
              <h3>{chapter.title}</h3>
              <span className={`grade-chip${chapterProgress?.status === "passed" ? " is-passed" : ""}`}>
                {chapterProgress?.status === "passed"
                  ? `квиз ${chapterProgress.grade ?? ""}`
                  : "квиз не сдан"}
              </span>
            </div>
            {chapter.lessonIds.map((lessonId) => {
              const lesson = progress.lessons[lessonId]
              const title = course.lessons.find((item) => item.id === lessonId)?.title ?? lessonId
              return (
                <div className="grade-row" key={lessonId}>
                  <span>{title}</span>
                  <span className={`grade-row__status grade-row__status--${lesson?.status ?? "locked"}`}>
                    {lesson?.status === "passed"
                      ? "сдано"
                      : lesson?.status === "in_progress"
                        ? "в работе"
                        : lesson?.status === "available"
                          ? "доступно"
                          : "закрыто"}
                  </span>
                  <span className="grade-row__grade">{lesson?.bestGrade ?? "—"}</span>
                  <span className="grade-row__attempts">{lesson?.attempts ?? 0} попыток</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
