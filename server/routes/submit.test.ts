import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import { DEFAULT_COURSE_META } from "../content/defaults"
import type { MentorService } from "../mentor/service"
import type { CourseSnapshot, LessonContent, Quiz } from "../content/types"

const quiz: Quiz = {
  title: "Проверь себя",
  questions: [
    { id: "q1", type: "single", prompt: "type(42)?", options: ["number", "string"], correct: 0, explanation: "number" },
    { id: "q2", type: "single", prompt: "false?", options: ["false", "0"], correct: 0, explanation: "false" },
    { id: "q3", type: "text", prompt: "Зачем local?", referenceAnswer: "область видимости", criteria: ["область"] },
    { id: "q4", type: "text", prompt: "Что такое nil?", referenceAnswer: "ничего", criteria: ["ничего"] },
  ],
}

function lesson(id: string): LessonContent {
  return {
    id,
    title: id,
    theoryMarkdown: "## Теория",
    practiceIntro: "",
    tasks: [
      {
        id: "task1",
        title: "Задание",
        prompt: "Сделай",
        kind: "code",
        entry: "main.lua",
        files: [{ name: "main.lua", content: 'print("ok")' }],
        args: [],
        stdin: "",
        timeoutMs: 3000,
      },
    ],
    quiz,
    errors: [],
  }
}

const variables = lesson("02-variables-types")
variables.tasks.push({
  id: "terminal",
  title: "Терминал",
  prompt: "Осмотрись",
  kind: "terminal",
  entry: "",
  files: [],
  args: [],
  stdin: "",
  timeoutMs: 3000,
})
variables.tasks.push({
  id: "project",
  title: "Проект",
  prompt: "Собери проект",
  kind: "project",
  entry: "main.lua",
  files: [{ name: "main.lua", content: "print('project')" }],
  args: [],
  stdin: "",
  timeoutMs: 3000,
})

const incomplete: LessonContent = {
  ...lesson("04-incomplete"),
  tasks: [],
  errors: [{ code: "lesson_missing_tasks", message: "Нет заданий" }],
}

const snapshot: CourseSnapshot = {
  version: "test",
  chapters: [
    {
      id: "foundations",
      title: "Основы",
      description: "",
      lessonIds: ["01-hello-lua", "02-variables-types", "03-control-flow", "04-incomplete"],
      quiz,
      errors: [],
    },
  ],
  lessons: {
    "01-hello-lua": lesson("01-hello-lua"),
    "02-variables-types": variables,
    "03-control-flow": lesson("03-control-flow"),
    "04-incomplete": incomplete,
  },
  unassigned: [],
  errors: [],
}

function fakeMentor(grade: number): MentorService {
  return {
    createSession: async () => "mock-session",
    deleteSession: async () => {},
    reviewLesson: async () => ({
      grade,
      verdict: grade >= 4 ? "pass" : "retry",
      summary: "Разбор",
      strengths: ["Плюс"],
      issues: ["Минус"],
      nextStep: "Дальше",
      tasks: [{ taskId: "task1", status: "ok", comment: "Верно" }],
      quiz: quiz.questions.map((q) => ({ questionId: q.id, correct: true, comment: "Верно" })),
    }),
    askMentor: async () => "Подсказка",
    summarizeSession: async () => "## Отчёт",
    classifyFolders: async () => ({ assignments: [], newChapters: [], reason: "" }),
  }
}

function makeApp(grade: number, mentorOverride?: MentorService) {
  const db = openDatabase(":memory:")
  migrate(db)
  return {
    db,
    app: createApp({
      db,
      course: snapshot,
      progressPath: resolve(process.cwd(), "PROGRESS.md"),
      mentor: mentorOverride ?? fakeMentor(grade),
    }),
  }
}

const generalCourse: CourseSnapshot = {
  version: "test",
  courses: [
    {
      ...DEFAULT_COURSE_META,
      id: "econ",
      title: "Экономика",
      description: "Личные финансы",
      theme: "amber",
      icon: "chart",
      mode: "general",
      builtIn: false,
      createdAt: "2026-10-22T00:00:00.000Z",
    },
  ],
  chapters: [
    {
      id: "econ-c1",
      courseId: "econ",
      title: "Деньги",
      description: "",
      lessonIds: ["econ-1"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: {
    "econ-1": { ...lesson("econ-1"), courseId: "econ", tasks: [] },
  },
  unassigned: [],
  errors: [],
}

function makeGeneralApp(grade = 4) {
  const db = openDatabase(":memory:")
  migrate(db)
  return {
    db,
    app: createApp({
      db,
      course: generalCourse,
      progressPath: resolve(process.cwd(), "does-not-exist.md"),
      mentor: fakeMentor(grade),
    }),
  }
}

const mathCourse: CourseSnapshot = {
  version: "test",
  courses: [
    {
      ...DEFAULT_COURSE_META,
      id: "math",
      title: "Математика",
      description: "Интегралы по шагам",
      theme: "ocean",
      icon: "atom",
      mode: "math",
      builtIn: false,
      createdAt: "2026-10-22T00:00:00.000Z",
    },
  ],
  chapters: [
    {
      id: "math-c1",
      courseId: "math",
      title: "Интегрирование",
      description: "",
      lessonIds: ["math-1"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: {
    "math-1": {
      ...lesson("math-1"),
      courseId: "math",
      tasks: [
        {
          id: "math-1-task-1",
          title: "Вычислить интеграл",
          prompt: "Решите интеграл по шагам.",
          kind: "steps",
          entry: "solution.json",
          files: [{ name: "solution.json", content: '{"steps":[],"answer":""}' }],
          args: [],
          stdin: "",
          timeoutMs: 3000,
          criteria: ["верный ход", "верный ответ"],
        },
      ],
    },
  },
  unassigned: [],
  errors: [],
}

function makeMathApp(grade = 4, mentorOverride?: MentorService) {
  const db = openDatabase(":memory:")
  migrate(db)
  return {
    db,
    app: createApp({
      db,
      course: mathCourse,
      progressPath: resolve(process.cwd(), "does-not-exist.md"),
      mentor: mentorOverride ?? fakeMentor(grade),
    }),
  }
}

describe("lesson submit", () => {
  it("unlocks next lesson on grade 4 and stores a full attempt", async () => {
    const { db, app } = makeApp(4)
    const res = await request(app)
      .post("/api/lessons/02-variables-types/submit")
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(true)
    expect(res.body.grade).toBe(4)

    const course = await request(app).get("/api/course")
    expect(course.body.access.lessons["03-control-flow"]).toBe("available")

    const attempt = db.prepare("select * from attempts order by id desc limit 1").get() as any
    expect(attempt.grade).toBe(4)
    expect(JSON.parse(attempt.code_json).task1[0].content).toContain("print")
    expect(JSON.parse(attempt.quiz_json)).toEqual({})

    const lesson = await request(app).get("/api/lessons/02-variables-types")
    expect(lesson.body.quiz.questions[0].correct).toBe(0)
  })

  it("includes project extra files in the mentor request and attempt snapshot", async () => {
    const captured: Array<{ tasks: Array<{ taskId: string; files: Array<{ name: string }> }> }> = []
    const base = fakeMentor(4)
    const mentor: MentorService = {
      ...base,
      reviewLesson: async (_sessionId, request) => {
        captured.push(request as any)
        return base.reviewLesson(_sessionId, request)
      },
    }
    const { db, app } = makeApp(4, mentor)
    db.prepare(
      "insert into task_files (lesson_id, task_id, file_name, content, updated_at) values (?, ?, ?, ?, ?)",
    ).run("02-variables-types", "project", "notes.md", "план проекта", new Date().toISOString())

    const res = await request(app).post("/api/lessons/02-variables-types/submit").send({})
    expect(res.status).toBe(200)
    const project = captured[0].tasks.find((task) => task.taskId === "project")
    expect(project?.files.some((file) => file.name === "notes.md")).toBe(true)

    const attempt = db.prepare("select * from attempts order by id desc limit 1").get() as any
    const code = JSON.parse(attempt.code_json)
    expect(code.project.some((file: any) => file.name === "notes.md")).toBe(true)
  })

  it("sends terminal history to the mentor and stores it in the attempt", async () => {
    const captured: Array<{ tasks: Array<{ taskId: string; terminalHistory?: Array<{ command: string }> }> }> = []
    const base = fakeMentor(4)
    const mentor: MentorService = {
      ...base,
      reviewLesson: async (_sessionId, request) => {
        captured.push(request as any)
        return base.reviewLesson(_sessionId, request)
      },
    }
    const { db, app } = makeApp(4, mentor)
    db.prepare(
      `insert into terminal_commands (lesson_id, task_id, command, stdout, stderr, exit_code, created_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    ).run("02-variables-types", "terminal", "pwd", "/workspace\n", "", 0, new Date().toISOString())

    await request(app).post("/api/lessons/02-variables-types/submit").send({})
    const terminal = captured[0].tasks.find((task) => task.taskId === "terminal")
    expect(terminal?.terminalHistory?.[0].command).toBe("pwd")

    const attempt = db.prepare("select * from attempts order by id desc limit 1").get() as any
    const runs = JSON.parse(attempt.runs_json)
    expect(runs.terminal.terminalHistory[0].command).toBe("pwd")
  })

  it("does not unlock on grade 3", async () => {
    const { app } = makeApp(3)
    const res = await request(app).post("/api/lessons/02-variables-types/submit").send({})
    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(false)
    const course = await request(app).get("/api/course")
    expect(course.body.access.lessons["03-control-flow"]).toBe("locked")
  })

  it("submits a general lesson whose practice is the 50/50 quiz", async () => {
    const { app, db } = makeGeneralApp(4)
    const res = await request(app).post("/api/lessons/econ-1/submit").send({})
    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(true)
    const attempt = db.prepare("select * from attempts order by id desc limit 1").get() as any
    expect(attempt.scope_id).toBe("econ-1")
    expect(JSON.parse(attempt.code_json)).toEqual({})
  })

  it("refuses to submit an empty step-by-step solution", async () => {
    const { app } = makeMathApp(4)
    const res = await request(app).post("/api/lessons/math-1/submit").send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("steps_empty")
  })

  it("sends a step-by-step solution and its criteria to the mentor", async () => {
    const captured: Array<{
      tasks: Array<{
        kind: string
        criteria?: string[]
        files: Array<{ name: string; content: string }>
      }>
    }> = []
    const base = fakeMentor(4)
    const mentor: MentorService = {
      ...base,
      reviewLesson: async (sessionId, reviewRequest) => {
        captured.push(reviewRequest as any)
        return base.reviewLesson(sessionId, reviewRequest)
      },
    }
    const { db, app } = makeMathApp(4, mentor)
    db.prepare(
      "insert into task_files (lesson_id, task_id, file_name, content, updated_at) values (?, ?, ?, ?, ?)",
    ).run(
      "math-1",
      "math-1-task-1",
      "solution.json",
      JSON.stringify({
        steps: [
          {
            formula: "\\int_0^1 x\\,dx = \\frac{1}{2}",
            explanation: "Первообразная и подстановка пределов.",
          },
        ],
        answer: "1/2",
      }),
      new Date().toISOString(),
    )

    const res = await request(app).post("/api/lessons/math-1/submit").send({})
    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(true)
    expect(captured[0].tasks[0].kind).toBe("steps")
    expect(captured[0].tasks[0].criteria).toEqual(["верный ход", "верный ответ"])
    expect(captured[0].tasks[0].files[0].content).toContain("Первообразная")
  })

  it("refuses to submit an incomplete lesson", async () => {
    const { db, app } = makeApp(4)
    db.prepare(
      "insert into lesson_progress (lesson_id, status, attempts) values ('04-incomplete', 'available', 0)",
    ).run()
    const res = await request(app).post("/api/lessons/04-incomplete/submit").send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("lesson_incomplete")
  })

  it("refuses to submit a locked lesson", async () => {
    const { app } = makeApp(4)
    const res = await request(app).post("/api/lessons/03-control-flow/submit").send({})
    expect(res.status).toBe(403)
  })
})
