# LearningLua Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать локальный Stepik-подобный учебный кабинет для курса «Лестница Lua»: 6 глав, 17 папок, теория, смешанные квизы, редактор Lua с LSP, запуск кода, графический предпросмотр LÖVE, учитель на OpenCode, оценки и итоговые отчёты занятий.

**Architecture:** Одно Node-приложение: Express 5 отдаёт API и собранный React, SQLite (`node:sqlite`) хранит прогресс и попытки, сканер читает `lessons/` и `course/` и следит за ними через `chokidar`. Учитель — отдельная OpenCode-сессия с агентом `lua-mentor`; она создаётся лениво и удаляется после отчёта. Практика: CodeMirror 6 + LSP-мост к `lua-language-server`, серверный Lua-раннер с постоянной рабочей папкой, браузерный предпросмотр LÖVE на `wasmoon` + `<canvas>`.

**Tech Stack:** Node 26, TypeScript, Express 5, `ws`, `node:sqlite`, `chokidar`, React 19, Vite, React Router, TanStack Query, Zustand, CodeMirror 6, `@codemirror/lsp-client`, `wasmoon`, `react-markdown`, `remark-gfm`, `rehype-highlight`, `zod`, Lucide, Vitest, Testing Library, Playwright, `@fontsource-variable/literata`, `@fontsource-variable/golos-text`, `@fontsource-variable/jetbrains-mono`.

**Spec:** `docs/superpowers/specs/2026-10-22-learninglua-platform-design.md`

## Global Constraints

- Платформа: macOS, Node ≥ 26, npm. Lua 5.5.1 и `luac` уже установлены; `lua-language-server` 3.19.2 установлен.
- OpenCode 2.x, отдельный агент `lua-mentor`, модель по умолчанию `opencode-go/deepseek-v4.1-flash`.
- Сервер слушает только `127.0.0.1`. Никаких данных из сети.
- Контент читается только из `lessons/**`, `course/**`, `reports/**`, `data/**`. Корневые файлы, включая `Без названия.md` и `PROGRESS.md`, не индексируются и не отправляются учителю.
- Теория — README до заголовка `## ✏️ Задания` / `## ✏️ Задание`. Практика — только `tasks/`. Вопросы — только `quiz.json`.
- Квиз: строго 50/50 `single`/`text`, минимум 4 вопроса в папке и 6 в главе.
- Порог допуска — 4. Никакой доступ не открывается без валидного ответа учителя с `grade >= 4`.
- Учитель не даёт готовый код: промпт + серверная проверка + контрольный пример.
- Код ученика хранится в БД и материализуется в `data/workspaces/**`; `lessons/**` не перезаписывается.
- Темы: светлая и тёмная; шрифты Literata / Golos Text / JetBrains Mono, кириллица обязательна.
- Тексты интерфейса на русском, sentence case; иконки — один набор Lucide.
- Все UI-задачи заканчиваются визуальной проверкой (скриншот светлой и тёмной темы).
- Git: инициализируется локально; `.gitignore` исключает `node_modules`, `dist`, `data`, `reports`, `.superpowers`, `.obsidian`, `.DS_Store`, `Без названия.md`.
- Каждая задача заканчивается коммитом.

## Review Focus

1. **Битый или неполный контент.** У папки нет README/заданий/квиза или JSON сломан. Ожидание: урок открывается, показывает понятную ошибку, сайт не падает, доступ не открывается. Тест — в Task 3.
2. **Бесконечный Lua-код.** `while true do end` в задании. Ожидание: процесс убивается по таймауту, панель вывода показывает ошибку, рабочая папка и код ученика целы. Тест — в Task 10.
3. **LSP недоступен или падает.** `lua-language-server` не найден/умер. Ожидание: редактор и запуск работают, статус «LSP недоступен», сдача не блокируется. Тест — в Task 11.
4. **Учитель вернул мусор или готовый код.** Невалидный JSON или код-блок с решением. Ожидание: доступ не меняется, один ретрай, затем понятная ошибка/вырезанный фрагмент; попытка не теряется. Тест — в Task 13.
5. **Новая папка появилась на лету.** Папка без главы, классификация ещё идёт. Ожидание: интерфейс стабилен, старая программа не перезагружается, ничего не разблокируется и не блокируется задним числом; классификация не блокирует рендер. Тест — в Task 18.

---

### Task 1: Каркас проекта, health-check и качество

**Files:**
- Create: `package.json`, `.gitignore`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `server/app.ts`, `server/index.ts`, `server/app.test.ts`, `src/main.tsx`, `src/App.tsx`
- Create: `scripts/start.sh`

**Interfaces:**
- Produces: `createApp(): Express`, `startServer(port?: number): Promise<http.Server>`.

- [ ] **Step 1: Инициализировать git и защитить чувствительные файлы**

```bash
cd /Volumes/Samsung/projects/learninglua
git init
printf 'node_modules/\ndist/\ndata/\nreports/\n.superpowers/\n.obsidian/\n.DS_Store\nБез названия.md\n' > .gitignore
```

- [ ] **Step 2: Создать `package.json` и установить зависимости**

Скрипты: `dev` (Vite + сервер), `build` (`tsc -p tsconfig.server.json && vite build`), `start` (`node --import tsx server/index.ts`), `test` (`vitest run`), `test:e2e` (`playwright test`), `typecheck` (`tsc --noEmit`).

- [ ] **Step 3: Написать падающий тест health-check**

`server/app.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import request from "supertest"
import { createApp } from "./app"

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(createApp()).get("/api/health")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok" })
  })
})
```

- [ ] **Step 4: Запустить тест и убедиться, что падает**

Run: `npx vitest run server/app.test.ts`
Expected: FAIL — модуль `./app` не найден.

- [ ] **Step 5: Реализовать `createApp` и `startServer`**

`createApp` возвращает Express-приложение с `express.json()` и маршрутом `GET /api/health`. `startServer` слушает `127.0.0.1` и возвращает `http.Server`.

- [ ] **Step 6: Проверить тест и типы**

Run: `npx vitest run server/app.test.ts && npm run typecheck`
Expected: PASS, 0 ошибок типов.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore tsconfig*.json vite.config.ts index.html server src scripts
git commit -m "chore: scaffold learninglua app and health check"
```

### Task 2: SQLite, миграции, схема

**Files:**
- Create: `server/db/index.ts`, `server/db/schema.ts`, `server/db/schema.test.ts`

**Interfaces:**
- Produces: `openDatabase(path: string): DatabaseSync`, `migrate(db: DatabaseSync): void`.

- [ ] **Step 1: Написать падающий тест миграции**

```ts
import { describe, expect, it } from "vitest"
import { openDatabase, migrate } from "./index"

describe("migrate", () => {
  it("creates all tables and is idempotent", () => {
    const db = openDatabase(":memory:")
    migrate(db)
    migrate(db)
    const names = db.prepare("select name from sqlite_master where type='table'").all().map((r: any) => r.name)
    expect(names).toEqual(expect.arrayContaining([
      "study_sessions", "activity_events", "lesson_progress", "chapter_progress",
      "quiz_answers", "task_files", "task_runs", "attempts", "mentor_messages",
      "content_versions", "terminal_state", "terminal_commands",
    ]))
  })
})
```

- [ ] **Step 2: Запустить тест и убедиться, что падает**

Run: `npx vitest run server/db/schema.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать схему и миграцию**

Таблицы и колонки — по разделу 8.4 спецификации. `attempts` хранит `code_json`, `runs_json`, `quiz_json`, `grade`, `feedback_json`. `content_versions` хранит `version`, `scanned_at`. `terminal_state` хранит `lesson_id`, `task_id`, `cwd`. `terminal_commands` хранит историю команд и вывод. Включить `PRAGMA foreign_keys = ON`.

- [ ] **Step 4: Проверить тест**

Run: `npx vitest run server/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/db
git commit -m "feat: add sqlite schema and migrations"
```

### Task 3: Сканер контента

**Files:**
- Create: `server/content/types.ts`, `server/content/theory.ts`, `server/content/tasks.ts`, `server/content/quiz.ts`, `server/content/scan.ts`
- Create: `server/content/scan.test.ts`, `server/content/__fixtures__/course/chapters.json`, `server/content/__fixtures__/lessons/01-demo/{README.md,quiz.json,tasks/task1.lua}`

**Interfaces:**
- Produces: `scanCourse(root: string): CourseSnapshot`, `validateQuiz(quiz: Quiz): ContentError[]`, типы `CourseSnapshot`, `LessonContent`, `TaskContent`, `Quiz`, `Question`, `Chapter`, `ContentError`.

- [ ] **Step 1: Написать тесты парсера**

```ts
describe("scanCourse", () => {
  it("splits theory from practice and reads tasks and quiz", () => {
    const course = scanCourse(fixtureRoot)
    const lesson = course.lessons["01-demo"]
    expect(lesson.theoryMarkdown).toContain("## Теория")
    expect(lesson.theoryMarkdown).not.toContain("## ✏️ Задания")
    expect(lesson.practiceIntro).toContain("task1.lua")
    expect(lesson.tasks[0]).toMatchObject({ id: "task1", entry: "task1.lua", kind: "code" })
    expect(lesson.quiz?.questions).toHaveLength(2)
  })

  it("reports broken content without throwing", () => {
    const course = scanCourse(brokenFixtureRoot)
    expect(course.errors.map(e => e.lessonId)).toContain("02-broken")
    expect(course.lessons["02-broken"].quiz).toBeNull()
  })

  it("ignores root files that are not lessons", () => {
    const course = scanCourse(projectRoot)
    expect(JSON.stringify(course)).not.toContain("Без названия")
  })
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/content/scan.test.ts`
Expected: FAIL — `scanCourse` не найден.

- [ ] **Step 3: Реализовать типы и парсеры**

`theory.ts` режет README по первому заголовку `## ✏️ Задания`/`## ✏️ Задание` (учитывать `---` перед ним). `tasks.ts` читает одиночные `.lua` (prompt из ведущих комментариев, entry = имя файла, sidecar `<name>.task.json` при наличии) и папки (README.md, task.json, файлы прямо в папке). `quiz.ts` валидирует 50/50, уникальные id, `correct` в границах. `scan.ts` читает `course/chapters.json`, папки `lessons/*`, помечает лишние папки `unassigned`, собирает `errors`.

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run server/content/scan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/content
git commit -m "feat: scan lessons, tasks and quizzes from disk"
```

### Task 4: Движок доступа и импорт старого прогресса

**Files:**
- Create: `server/access.ts`, `server/access.test.ts`, `server/db/seed.ts`, `server/db/seed.test.ts`

**Interfaces:**
- Consumes: `CourseSnapshot` из Task 3.
- Produces: `computeAccess(snapshot: CourseSnapshot, lessonProgress: LessonProgressRow[], chapterProgress: ChapterProgressRow[]): AccessState`, `seedFromProgressIfEmpty(db, snapshot, progressPath): void`.

- [ ] **Step 1: Написать тесты доступа**

```ts
it("opens the first lesson only", () => {
  const access = computeAccess(snapshot, [], [])
  expect(access.lessons["01-hello-lua"]).toBe("available")
  expect(access.lessons["02-variables-types"]).toBe("locked")
})

it("opens next lesson after pass and chapter quiz after all lessons", () => {
  const progress = [passed("01-hello-lua"), passed("02-variables-types"), passed("03-control-flow")]
  const access = computeAccess(snapshot, progress, [])
  expect(access.lessons["04-functions"]).toBe("locked")
  expect(access.chapters["foundations"]).toBe("in_progress")
  expect(access.nextChapterQuizId).toBe("foundations")
})

it("never relocks an already available lesson", () => {
  const access = computeAccess(snapshotAfterReorder, [available("02-variables-types")], [])
  expect(access.lessons["02-variables-types"]).toBe("available")
})

it("imports old progress once", () => {
  seedFromProgressIfEmpty(db, snapshot, "PROGRESS.md")
  expect(lessonRow(db, "01-hello-lua")).toMatchObject({ status: "passed", best_grade: 5 })
  expect(lessonRow(db, "02-variables-types")).toMatchObject({ status: "available" })
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/access.test.ts server/db/seed.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать `computeAccess` и `seedFromProgressIfEmpty`**

Правила: первый урок главы доступен, если глава открыта; следующий урок — после `passed`; квиз главы — после всех `passed`; следующая глава — после `passed` квиза главы; импортированные/открытые статусы не понижаются. Импорт читает `PROGRESS.md` только при пустых таблицах и ставит `01` = passed/5, `02` = available.

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run server/access.test.ts server/db/seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/access.ts server/access.test.ts server/db/seed.ts server/db/seed.test.ts
git commit -m "feat: compute lesson access and import old progress"
```

### Task 5: API курса и прогресса

**Files:**
- Create: `server/routes/course.ts`, `server/routes/progress.ts`, `server/routes/course.test.ts`
- Modify: `server/app.ts`

**Interfaces:**
- Consumes: `scanCourse`, `computeAccess`.
- Produces: `GET /api/course`, `GET /api/lessons/:id`, `GET /api/progress`.

- [ ] **Step 1: Написать падающие тесты API**

```ts
it("returns course without correct answers", async () => {
  const res = await request(app).get("/api/course")
  expect(res.body.chapters).toHaveLength(6)
  expect(JSON.stringify(res.body)).not.toContain("referenceAnswer")
  expect(JSON.stringify(res.body)).not.toContain('"correct"')
})

it("returns a lesson with tasks and quiz", async () => {
  const res = await request(app).get("/api/lessons/02-variables-types")
  expect(res.body.tasks.length).toBeGreaterThan(0)
  expect(res.body.quiz.questions.length).toBeGreaterThan(0)
})

it("returns progress with grades and attempts", async () => {
  const res = await request(app).get("/api/progress")
  expect(res.body.lessons["01-hello-lua"].bestGrade).toBe(5)
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/routes/course.test.ts`
Expected: FAIL 404.

- [ ] **Step 3: Реализовать маршруты**

`/api/course` собирает снимок, доступ и текущую сессию; удаляет правильные ответы и `referenceAnswer` из публичных квизов. `/api/lessons/:id` возвращает теорию, практику и квиз без ответов. `/api/progress` — оценки, попытки, отчёты.

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run server/routes/course.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes server/app.ts
git commit -m "feat: expose course and progress api"
```

### Task 6: Оболочка A, темы, сайдбар

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/app/AppShell.tsx`, `src/app/router.tsx`, `src/components/Sidebar.tsx`, `src/components/ThemeToggle.tsx`, `src/lib/theme.ts`, `src/app/AppShell.test.tsx`
- Modify: `src/App.tsx`, `index.html`

**Interfaces:**
- Consumes: `GET /api/course`.
- Produces: `AppShell`, `useTheme()`, `ThemeToggle`, `Sidebar`.

- [ ] **Step 1: Написать падающие тесты оболочки**

```tsx
it("renders chapters and locked lessons", async () => {
  render(<AppShell />)
  expect(await screen.findByText("Основы")).toBeInTheDocument()
  expect(screen.getByText("Функции")).toBeInTheDocument()
  expect(screen.getByText("закрыто")).toBeInTheDocument()
})

it("persists theme choice", () => {
  render(<ThemeToggle />)
  fireEvent.click(screen.getByRole("button", { name: /тёмная тема/i }))
  expect(document.documentElement.dataset.theme).toBe("dark")
  expect(localStorage.getItem("learninglua.theme")).toBe("dark")
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run src/app/AppShell.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать токены, темы и оболочку**

Токены из раздела 7.1 спецификации. `index.html` содержит инлайн-скрипт, который ставит `data-theme` до React. Сайдбар: бренд, прогресс, главы, папки, квизы глав, блок «Новые материалы», статус занятия, тема. Никаких карточек-плиток; вертикальный орбитальный ритм, Lucide-иконки.

- [ ] **Step 4: Проверить тесты и типы**

Run: `npx vitest run src/app/AppShell.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Визуальная проверка обеих тем**

Открыть страницу, снять скриншот светлой и тёмной темы; проверить сайдбар, контраст, отсутствие обрезанного текста.

- [ ] **Step 6: Commit**

```bash
git add src index.html
git commit -m "feat: add app shell, theme system and sidebar"
```

### Task 7: Страница урока, теория, вкладки

**Files:**
- Create: `src/features/lesson/LessonPage.tsx`, `src/features/lesson/TheoryTab.tsx`, `src/features/lesson/lesson.test.tsx`, `src/lib/markdown.tsx`

**Interfaces:**
- Consumes: `GET /api/lessons/:id`.
- Produces: `LessonPage`, `TheoryTab`.

- [ ] **Step 1: Написать падающие тесты**

```tsx
it("renders theory only and keeps practice in its tab", async () => {
  render(<LessonPage lessonId="02-variables-types" />)
  expect(await screen.findByRole("heading", { name: /Переменные: global и local/ })).toBeInTheDocument()
  expect(screen.queryByText("task1_types.lua")).not.toBeInTheDocument()
})

it("switches tabs and renders practice intro", async () => {
  render(<LessonPage lessonId="02-variables-types" />)
  fireEvent.click(await screen.findByRole("tab", { name: /Практика/ }))
  expect(await screen.findByText(/task1_types.lua/)).toBeInTheDocument()
})

it("does not render raw html from markdown", async () => {
  render(<TheoryTab markdown={'<script>alert(1)</script>'} />)
  expect(document.querySelector("script")).toBeNull()
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run src/features/lesson/lesson.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать страницу и markdown**

Вкладки с URL (`?tab=theory|questions|practice`), ARIA `tablist`, активная подчёркнута. Markdown: `react-markdown` + `remark-gfm` + `rehype-highlight`, без `rehype-raw`. Код-блоки с подсветкой Lua. Вкладка практики получает `practiceIntro`.

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run src/features/lesson/lesson.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lesson src/lib
git commit -m "feat: render lesson theory and tabs"
```

### Task 8: Квиз папки

**Files:**
- Create: `server/routes/quiz.ts`, `server/routes/quiz.test.ts`
- Create: `src/features/quiz/QuizTab.tsx`, `src/features/quiz/QuestionCard.tsx`, `src/features/quiz/quiz.test.tsx`

**Interfaces:**
- Consumes: `Quiz`, `validateQuiz`.
- Produces: `PUT /api/lessons/:id/quiz-answers`, `QuizTab`, `QuestionCard`.

- [ ] **Step 1: Написать падающие тесты сервера**

```ts
it("rejects a quiz that is not 50/50", () => {
  expect(validateQuiz({ title: "x", questions: [single, single] }).map(e => e.code)).toContain("quiz_ratio")
})

it("saves answers without leaking correct options", async () => {
  await request(app).put("/api/lessons/02-variables-types/quiz-answers").send({ answers: { q1: 0 } })
  const res = await request(app).get("/api/lessons/02-variables-types")
  expect(res.body.quiz.questions[0]).not.toHaveProperty("correct")
})
```

- [ ] **Step 2: Написать падающие тесты UI**

```tsx
it("renders mixed questions and saves answers", async () => {
  render(<QuizTab lessonId="02-variables-types" />)
  expect(await screen.findByRole("radio", { name: "number" })).toBeInTheDocument()
  expect(screen.getByRole("textbox")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("radio", { name: "number" }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/quiz-answers"), expect.objectContaining({ method: "PUT" })))
})
```

- [ ] **Step 3: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/routes/quiz.test.ts src/features/quiz/quiz.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Реализовать API и UI**

Сохранение по `question.id`, debounce 500 мс. Тест — radio-группы, письменный — textarea с `placeholder`. До сдачи не показывать правильность. Прогресс «отвечено X из Y».

- [ ] **Step 5: Проверить тесты**

Run: `npx vitest run server/routes/quiz.test.ts src/features/quiz/quiz.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/quiz.ts server/routes/quiz.test.ts src/features/quiz
git commit -m "feat: add lesson quiz with autosave"
```

### Task 9: Редактор практики, файлы, автосохранение

**Files:**
- Create: `src/features/practice/PracticeTab.tsx`, `src/features/practice/CodeEditor.tsx`, `src/features/practice/FileTabs.tsx`, `src/features/practice/EditorSettings.tsx`, `src/features/practice/practice.test.tsx`
- Create: `server/routes/task-files.ts`, `server/routes/task-files.test.ts`

**Interfaces:**
- Consumes: `TaskContent`.
- Produces: `PracticeTab`, `CodeEditor`, `PUT /api/tasks/:lessonId/:taskId/files`, `GET /api/tasks/:lessonId/:taskId/files`.

- [ ] **Step 1: Написать падающие тесты сервера**

```ts
it("stores and returns task files", async () => {
  await request(app).put("/api/tasks/02-variables-types/task1_types/files").send({
    files: [{ name: "task1_types.lua", content: "local x = 1" }],
  })
  const res = await request(app).get("/api/tasks/02-variables-types/task1_types/files")
  expect(res.body.files[0].content).toBe("local x = 1")
})
```

- [ ] **Step 2: Написать падающие тесты UI**

```tsx
it("shows file tabs, Lua highlighting and saves edits", async () => {
  render(<PracticeTab lessonId="02-variables-types" taskId="task1_types" />)
  expect(await screen.findByRole("tab", { name: "task1_types.lua" })).toBeInTheDocument()
  expect(document.querySelector(".cm-editor")).toBeInTheDocument()
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "print(1)" } })
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/files"), expect.objectContaining({ method: "PUT" })))
})
```

- [ ] **Step 3: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/routes/task-files.test.ts src/features/practice/practice.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Реализовать API и редактор**

CodeMirror: `@codemirror/lang-lua`, `basicSetup`, line numbers, bracket matching, history, search, `indentWithTab`. Настройки: 2 пробела / 4 пробела / символ таба; хранятся в localStorage и отправляются в БД. Автосохранение 800 мс. Файловые табы, добавление/удаление файла для `kind: "project"`. `Сбросить задание`.

- [ ] **Step 5: Проверить тесты**

Run: `npx vitest run server/routes/task-files.test.ts src/features/practice/practice.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/practice server/routes/task-files*
git commit -m "feat: add multi-file lua editor with autosave"
```

### Task 10: Lua-раннер и постоянная рабочая папка

**Files:**
- Create: `server/lua/runner.ts`, `server/lua/workspace.ts`, `server/lua/runner.test.ts`, `server/routes/run.ts`, `server/routes/run.test.ts`
- Create: `src/features/practice/RunPanel.tsx`

**Interfaces:**
- Produces: `runLuaTask(input: RunTaskInput): Promise<RunResult>`, `resetTaskWorkspace(lessonId, taskId, starterFiles): Promise<void>`, `POST /api/tasks/:lessonId/:taskId/run`.

- [ ] **Step 1: Написать падающие тесты раннера**

```ts
it("runs a script and captures stdout", async () => {
  const res = await runLuaTask({ lessonId: "01", taskId: "t", files: [{ name: "main.lua", content: 'print("привет")' }], entry: "main.lua", timeoutMs: 3000 })
  expect(res.stdout.trim()).toBe("привет")
  expect(res.exitCode).toBe(0)
})

it("passes stdin and args", async () => {
  const res = await runLuaTask({ lessonId: "01", taskId: "t2", files: [{ name: "main.lua", content: 'print(arg[1]); print(io.read())' }], entry: "main.lua", args: ["раз"], stdin: "два\n", timeoutMs: 3000 })
  expect(res.stdout.trim().split("\n")).toEqual(["раз", "два"])
})

it("kills an infinite loop", async () => {
  const res = await runLuaTask({ lessonId: "01", taskId: "t3", files: [{ name: "main.lua", content: "while true do end" }], entry: "main.lua", timeoutMs: 500 })
  expect(res.timedOut).toBe(true)
})

it("persists files between runs", async () => {
  await runLuaTask({ lessonId: "06", taskId: "diary", files: [{ name: "main.lua", content: 'local f=io.open("diary.txt","a"); f:write("x\\n"); f:close()' }], entry: "main.lua", timeoutMs: 3000 })
  const second = await runLuaTask({ lessonId: "06", taskId: "diary", files: [{ name: "main.lua", content: 'local f=io.open("diary.txt","r"); print(f:read("a")); f:close()' }], entry: "main.lua", timeoutMs: 3000 })
  expect(second.stdout).toContain("x")
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/lua/runner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать workspace и runner**

Рабочая папка `data/workspaces/<lesson>/<task>/`; перед запуском записать файлы; `LUA_PATH="./?.lua;./?/init.lua;;"`; spawn `lua entry` с `cwd`; таймаут, kill process group, лимит вывода 64 КБ; `luac -p` до запуска. `resetTaskWorkspace` очищает папку и пишет starter-файлы.

- [ ] **Step 4: Реализовать API и панель вывода**

`RunPanel`: stdout/stderr, exit code, duration, stdin и args, кнопки «Проверить» и «Сбросить». Ctrl/Cmd+Enter запускает.

- [ ] **Step 5: Проверить тесты**

Run: `npx vitest run server/lua server/routes/run.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lua server/routes/run* src/features/practice/RunPanel.tsx
git commit -m "feat: run lua tasks with persistent workspace"
```

### Task 10b: Терминальная практика

**Files:**
- Create: `server/terminal/runner.ts`, `server/terminal/runner.test.ts`, `server/routes/terminal.ts`, `server/routes/terminal.test.ts`
- Create: `src/features/practice/TerminalPanel.tsx`, `src/features/practice/terminal.test.tsx`

**Interfaces:**
- Produces: `runTerminalCommand(input: TerminalCommandInput): Promise<TerminalCommandResult>`, `POST /api/tasks/:lessonId/:taskId/terminal`, `TerminalPanel`.

- [ ] **Step 1: Написать падающие тесты раннера**

```ts
it("runs a command in the task workspace", async () => {
  const res = await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "pwd" })
  expect(res.stdout.trim()).toContain("data/workspaces/terminal-basics/t1")
  expect(res.exitCode).toBe(0)
})

it("persists cd between commands", async () => {
  await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "mkdir sub" })
  await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "cd sub" })
  const res = await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "pwd" })
  expect(res.stdout.trim().endsWith("/sub")).toBe(true)
})

it("supports pipes and redirection", async () => {
  await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: 'echo "a" > f.txt' })
  const res = await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "cat f.txt | wc -l" })
  expect(res.stdout.trim()).toBe("1")
})

it("times out a hanging command", async () => {
  const res = await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "sleep 5", timeoutMs: 300 })
  expect(res.timedOut).toBe(true)
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/terminal/runner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать раннер**

Рабочая папка — `data/workspaces/<lesson>/<task>/`; команды через `sh -c`; `cd` без пайпов/редиректов обрабатывается отдельно и сохраняет cwd в таблице `terminal_state` (добавить в Task 2 миграцию); таймаут 3 с; лимит вывода 64 КБ; история команд в БД.

- [ ] **Step 4: Реализовать API и терминальную панель**

`TerminalPanel`: поле ввода, история, вывод, код возврата, `Ctrl+L` очистить, `↑/↓` история, подсказки команд. Сохранение истории.

- [ ] **Step 5: Проверить тесты**

Run: `npx vitest run server/terminal server/routes/terminal.test.ts src/features/practice/terminal.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/terminal server/routes/terminal* src/features/practice/TerminalPanel.tsx src/features/practice/terminal.test.tsx
git commit -m "feat: add terminal practice runner"
```

### Task 11: LSP-мост

**Files:**
- Create: `server/lsp/bridge.ts`, `server/lsp/bridge.test.ts`, `src/features/practice/useLsp.ts`, `src/features/practice/LspStatus.tsx`
- Modify: `server/index.ts`, `src/features/practice/CodeEditor.tsx`

**Interfaces:**
- Produces: `attachLspBridge(ws: WebSocket): void`, `connectLspBridge(url: string): TestBridge` (тестовый хелпер), `useLsp(lessonId: string, taskId: string)`, `LspStatus`.

- [ ] **Step 1: Написать падающий тест моста с фейковым LSP**

```ts
it("forwards initialize and diagnostics", async () => {
  const fake = startFakeLspServer()
  const bridge = attachLspBridgeToSocket(fake.url)
  bridge.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }))
  const reply = await bridge.nextMessage()
  expect(reply.id).toBe(1)
  expect(reply.result.capabilities).toBeDefined()
})
```

- [ ] **Step 2: Написать интеграционный тест с настоящим LSP**

```ts
it.skipIf(!hasLuaLs)("gets diagnostics for a syntax error", async () => {
  const bridge = attachLspBridge(spawn("lua-language-server"))
  const messages = await collectAfterOpen(bridge, "file:///tmp/test.lua", "local = 1")
  expect(messages.some(m => m.method === "textDocument/publishDiagnostics")).toBe(true)
})
```

- [ ] **Step 3: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/lsp/bridge.test.ts`
Expected: FAIL.

- [ ] **Step 4: Реализовать мост и клиент**

Мост: WS ↔ `lua-language-server` stdio, LSP-фрейминг `Content-Length`. Клиент: `@codemirror/lsp-client`, `LSPClient({ extensions: languageServerExtensions() }).connect(transport)`, `client.plugin("file:///.../file.lua")`. Документы открываются из редактора. Если процесс не стартовал или упал — статус «LSP недоступен», редактор продолжает работать.

- [ ] **Step 5: Проверить тесты и вручную**

Run: `npx vitest run server/lsp/bridge.test.ts`
Expected: PASS или SKIP, если `lua-language-server` нет. Затем открыть редактор, ввести `local = 1` и увидеть диагностику; убить LSP и убедиться, что редактор работает.

- [ ] **Step 6: Commit**

```bash
git add server/lsp src/features/practice/useLsp.ts src/features/practice/LspStatus.tsx server/index.ts
git commit -m "feat: add lua language server bridge"
```

### Task 12: Предпросмотр LÖVE в браузере

**Files:**
- Create: `src/features/practice/love/LovePreview.tsx`, `src/features/practice/love/love-shim.ts`, `src/features/practice/love/love-worker.ts`, `src/features/practice/love/love.test.ts`
- Modify: `src/features/practice/PracticeTab.tsx`

**Interfaces:**
- Produces: `runLovePreview(files: TaskFile[], entry: string): Promise<LoveRunResult>`, `LovePreview`, поддержка `kind: "love"`.

- [ ] **Step 1: Написать падающий тест шима**

```ts
it("records love.graphics calls from lua", async () => {
  const result = await runLovePreview([
    { name: "main.lua", content: 'function love.draw() love.graphics.setColor(1,0,0); love.graphics.rectangle("fill", 10, 20, 30, 40) end' },
  ], "main.lua")
  expect(result.errors).toEqual([])
  expect(result.commands).toContainEqual({ kind: "rect", mode: "fill", x: 10, y: 20, w: 30, h: 40 })
})

it("returns lua errors", async () => {
  const result = await runLovePreview([{ name: "main.lua", content: "function love.draw() error('boom') end" }], "main.lua")
  expect(result.errors[0]).toContain("boom")
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run src/features/practice/love/love.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать шим и canvas-рендер**

`wasmoon` в Web Worker. Глобальный `love` с `load/update/draw`, `graphics.setColor/clear/rectangle/circle/line/print/polygon`, `timer.getDelta`, `keypressed`, `mousepressed`. Собирать команды, рисовать в `<canvas>` в основном потоке. Поддерживаемый список функций показывать в уроке. Ошибки Lua — в панель вывода. `kind: "love"` использует предпросмотр вместо серверного раннера.

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run src/features/practice/love/love.test.ts`
Expected: PASS.

- [ ] **Step 5: Визуальная проверка**

Открыть LÖVE-задание, увидеть фигуры на canvas, поменять цвет и координаты, убедиться, что предпросмотр обновился.

- [ ] **Step 6: Commit**

```bash
git add src/features/practice/love src/features/practice/PracticeTab.tsx
git commit -m "feat: add love2d canvas preview"
```

### Task 13: Учитель, OpenCode-сессия и защита от готового кода

**Files:**
- Create: `.opencode/agents/lua-mentor.md`, `server/mentor/client.ts`, `server/mentor/review.ts`, `server/mentor/guard.ts`, `server/mentor/mentor.test.ts`
- Modify: `opencode.json` (создать при необходимости)

**Interfaces:**
- Produces: `createMentorSession(options?: { baseUrl?: string; directory?: string }): Promise<string>`, `deleteMentorSession(id: string): Promise<void>`, `reviewLesson(req: MentorReviewRequest): Promise<MentorReviewResult>`, `askMentor(sessionId: string, context: MentorContext, question: string): Promise<string>`, `stripReadyCode(md: string): string`.

- [ ] **Step 1: Создать агента**

`.opencode/agents/lua-mentor.md`: frontmatter `mode: primary`, `model: opencode-go/deepseek-v4.1-flash`, `permissions: [{action: edit, resource: "*", effect: deny}, {action: shell, resource: "*", effect: deny}, {action: read, resource: "*", effect: deny}]`, `steps: 2`. Системный промпт: сократический стиль, не давать готовый код, JSON-схема, русский язык, учитывать только присланный контекст.

- [ ] **Step 2: Написать падающие тесты с фейковым OpenCode-сервером**

```ts
it("creates a session with agent and model", async () => {
  const fake = await startFakeOpenCode()
  await createMentorSession({ baseUrl: fake.url, directory: root })
  expect(fake.requests[0]).toMatchObject({ method: "POST", path: "/api/session" })
  expect(fake.requests[0].body).toMatchObject({ agent: "lua-mentor", model: { providerID: "opencode-go", model: "deepseek-v4.1-flash" } })
})

it("retries invalid json once, then fails without unlock", async () => {
  const fake = await startFakeOpenCode({ replies: ["не json", "не json"] })
  await expect(reviewLesson({ ...req, client: fake.client })).rejects.toThrow("mentor_invalid_json")
})

it("strips ready code blocks", () => {
  const md = "Тут решение:\n```lua\nlocal function f() return 1 end\nlocal function g() return 2 end\n```\nПодумай."
  expect(stripReadyCode(md)).not.toContain("local function f")
  expect(stripReadyCode(md)).toContain("[фрагмент скрыт")
})
```

- [ ] **Step 3: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/mentor/mentor.test.ts`
Expected: FAIL.

- [ ] **Step 4: Реализовать клиент, проверку и guard**

OpenCode HTTP: `POST /api/session`, `POST /api/session/:id/prompt`, `GET /api/event` (SSE), `DELETE /api/session/:id`. Таймаут 180 с. Парсинг JSON из ответа (последний fenced-блок или первый объект). Guard: фенсед-блок с кодом > 2 строк или Lua-блок с `function ... end` внутри считается готовым решением; ретрай один раз; затем вырезание с пометкой. Инлайн-код разрешён.

- [ ] **Step 5: Добавить режим `MENTOR_MODE=mock`**

При `MENTOR_MODE=mock` клиент не ходит в OpenCode, а возвращает детерминированные ответы: `grade: 4` для тестового урока, валидный JSON разбора, отчёт с обязательными разделами. Это нужно для e2e и unit-тестов, чтобы не тратить токены.

- [ ] **Step 6: Проверить тесты и реальный smoke**

Run: `npx vitest run server/mentor/mentor.test.ts`
Expected: PASS. Затем один раз создать сессию с реальным OpenCode, отправить короткий запрос и убедиться, что ответ приходит и сессия удаляется.

- [ ] **Step 7: Commit**

```bash
git add .opencode opencode.json server/mentor
git commit -m "feat: add opencode mentor agent and response guard"
```

### Task 14: Сдача урока, попытки и разблокировка

**Files:**
- Create: `server/routes/submit.ts`, `server/routes/submit.test.ts`, `src/features/practice/SubmitPanel.tsx`, `src/features/practice/FeedbackPanel.tsx`

**Interfaces:**
- Consumes: `reviewLesson`, `runLuaTask`, `computeAccess`.
- Produces: `POST /api/lessons/:id/submit`, `SubmitPanel`, `FeedbackPanel`.

- [ ] **Step 1: Написать падающие тесты сдачи**

```ts
it("unlocks next lesson on grade 4", async () => {
  const res = await request(app).post("/api/lessons/02-variables-types/submit").send({})
  expect(res.body.grade).toBe(4)
  const course = await request(app).get("/api/course")
  expect(course.body.access.lessons["03-control-flow"]).toBe("available")
})

it("does not unlock on grade 3", async () => {
  const res = await request(app).post("/api/lessons/02-variables-types/submit").send({})
  expect(res.body.grade).toBe(3)
  const course = await request(app).get("/api/course")
  expect(course.body.access.lessons["03-control-flow"]).toBe("locked")
})

it("stores a full attempt snapshot", async () => {
  await request(app).post("/api/lessons/02-variables-types/submit").send({})
  const attempt = db.prepare("select * from attempts order by id desc limit 1").get()
  expect(JSON.parse(attempt.code_json)).toBeTruthy()
  expect(JSON.parse(attempt.quiz_json)).toBeTruthy()
})

it("reveals correct answers only after pass", async () => {
  const passed = await request(app).get("/api/lessons/02-variables-types")
  expect(passed.body.quiz.questions[0].correct).toBeUndefined()
  await request(app).post("/api/lessons/02-variables-types/submit").send({})
  const after = await request(app).get("/api/lessons/02-variables-types")
  expect(after.body.quiz.questions[0].correct).toBeDefined()
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/routes/submit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать маршрут сдачи**

Собирает код, последние запуски, ответы, прошлые попытки. Вызывает `reviewLesson`. Сохраняет `attempts` и `feedback_json`. При `grade >= 4 && verdict === "pass"` открывает следующую папку. При ошибке учителя ничего не открывает и возвращает понятную ошибку. UI: «Проверить», «Сдать урок», разбор по заданиям/вопросам, кнопка «Доработать и сдать снова», «Следующий урок».

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run server/routes/submit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/submit* src/features/practice/SubmitPanel.tsx src/features/practice/FeedbackPanel.tsx
git commit -m "feat: submit lesson, store attempts and unlock next"
```

### Task 15: Квиз главы и чат с наставником

**Files:**
- Create: `server/routes/chapter-quiz.ts`, `server/routes/chapter-quiz.test.ts`, `server/routes/mentor-ask.ts`, `server/routes/mentor-ask.test.ts`
- Create: `src/features/chapter/ChapterQuizPage.tsx`, `src/features/mentor/MentorDrawer.tsx`, `src/features/mentor/mentor.test.tsx`

**Interfaces:**
- Produces: `POST /api/chapters/:id/quiz/submit`, `POST /api/mentor/ask`, `ChapterQuizPage`, `MentorDrawer`.

- [ ] **Step 1: Написать падающие тесты**

```ts
it("chapter quiz is locked until all lessons pass", async () => {
  const res = await request(app).post("/api/chapters/foundations/quiz/submit").send({})
  expect(res.status).toBe(403)
})

it("opens next chapter after chapter quiz pass", async () => {
  await passAllLessons(app, "foundations")
  const res = await request(app).post("/api/chapters/foundations/quiz/submit").send({})
  expect(res.body.grade).toBeGreaterThanOrEqual(4)
  const course = await request(app).get("/api/course")
  expect(course.body.access.lessons["04-functions"]).toBe("available")
})

it("mentor chat sends current code and keeps history", async () => {
  const res = await request(app).post("/api/mentor/ask").send({ lessonId: "02-variables-types", taskId: "task1_types", question: "Почему не работает?" })
  expect(res.body.answer).toBeTruthy()
  expect(db.prepare("select count(*) c from mentor_messages").get().c).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/routes/chapter-quiz.test.ts server/routes/mentor-ask.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать квиз главы и чат**

Квиз главы: доступен после всех папок; отдельная оценка; открывает следующую главу только при 4+. Чат: контекст текущего урока, задания, кода, последнего вывода; ответы без готового кода; история в `mentor_messages`; drawer справа.

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run server/routes/chapter-quiz.test.ts server/routes/mentor-ask.test.ts src/features/mentor/mentor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/chapter-quiz* server/routes/mentor-ask* src/features/chapter src/features/mentor
git commit -m "feat: add chapter quiz and mentor chat"
```

### Task 16: Учебная сессия и итоговый отчёт

**Files:**
- Create: `server/sessions/lifecycle.ts`, `server/sessions/report.ts`, `server/sessions/session.test.ts`, `server/routes/session.ts`, `server/routes/session.test.ts`
- Create: `src/features/session/SessionBadge.tsx`, `src/features/session/ReportCard.tsx`

**Interfaces:**
- Produces: `startSession(): string`, `recordActivity(event: ActivityEvent): void`, `endSession(id: string, reason: string): void`, `finalizeSession(id: string): Promise<void>`, `POST /api/session/start|end|heartbeat`, `GET /api/session/current`.

- [ ] **Step 1: Написать падающие тесты сессии**

```ts
it("discards a short visit without ai call", async () => {
  const id = startSession()
  endSession(id, "beacon")
  expect(db.prepare("select status from study_sessions where id = ?").get(id).status).toBe("discarded")
  expect(fakeMentor.calls).toHaveLength(0)
})

it("generates a report after meaningful activity", async () => {
  const id = startSession()
  recordActivity({ kind: "run", lessonId: "02-variables-types", taskId: "task1_types" })
  endSession(id, "beacon")
  await finalizeSession(id)
  expect(db.prepare("select summary_md from study_sessions where id = ?").get(id).summary_md).toContain("Сильные стороны")
  expect(fs.existsSync(`reports/session-${id}.md`)).toBe(true)
})

it("falls back without ai when mentor is down", async () => {
  fakeMentor.fail = true
  await finalizeSession(id)
  expect(db.prepare("select status from study_sessions where id = ?").get(id).status).toBe("completed_with_warnings")
  expect(db.prepare("select summary_md from study_sessions where id = ?").get(id).summary_md).toContain("без ИИ")
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/sessions/session.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать жизненный цикл**

Старт при открытии урока; `activity_events`; значимая активность; `sendBeacon`; heartbeat; idle 30 мин; финализация в фоне; отчёт с 8 разделами из 6.7; Markdown-файл в `reports/`; удаление OpenCode-сессии; остановка LSP. UI: индикатор занятия, кнопка «Завершить занятие», карточка «Итог прошлого занятия».

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run server/sessions server/routes/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/sessions server/routes/session* src/features/session
git commit -m "feat: add study session lifecycle and reports"
```

### Task 17: Успеваемость

**Files:**
- Create: `src/features/performance/PerformancePage.tsx`, `src/features/performance/GradeTable.tsx`, `src/features/performance/ReportList.tsx`, `src/features/performance/performance.test.tsx`
- Modify: `server/routes/progress.ts`

**Interfaces:**
- Consumes: `GET /api/progress`.
- Produces: `PerformancePage`, `GradeTable`, `ReportList`.

- [ ] **Step 1: Написать падающие тесты**

```tsx
it("shows grades, attempts and reports", async () => {
  render(<PerformancePage />)
  expect(await screen.findByText("Основы")).toBeInTheDocument()
  expect(screen.getByText("01 · Hello, Lua")).toBeInTheDocument()
  expect(screen.getByText("5")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /итоги занятий/i }))
  expect(await screen.findByText(/Сильные стороны/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run src/features/performance/performance.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать страницу**

Орбитальный прогресс, оценки по главам/папкам, список попыток с раскрываемым разбором, отчёты занятий, процент текущей главы. Без библиотеки графиков — SVG/CSS.

- [ ] **Step 4: Проверить тесты и визуально**

Run: `npx vitest run src/features/performance/performance.test.tsx`
Expected: PASS. Затем скриншоты светлой/тёмной темы.

- [ ] **Step 5: Commit**

```bash
git add src/features/performance server/routes/progress.ts
git commit -m "feat: add performance page"
```

### Task 18: Горячая загрузка и классификация новых папок

**Files:**
- Create: `server/content/watcher.ts`, `server/content/classify.ts`, `server/routes/events.ts`, `server/content/classify.test.ts`
- Create: `src/features/course/NewMaterialBanner.tsx`

**Interfaces:**
- Produces: `startContentWatcher(root, onChange)`, `classifyUnassigned(snapshot, client): Promise<ClassificationResult>`, `GET /api/events`, `NewMaterialBanner`.

- [ ] **Step 1: Написать падающие тесты**

```ts
it("emits an event and bumps version on content change", async () => {
  const events: string[] = []
  const stop = startContentWatcher(fixtureRoot, e => events.push(e.version))
  await fs.writeFile(`${fixtureRoot}/lessons/01-demo/README.md`, "## Теория\n\nновое\n")
  await waitFor(() => expect(events.length).toBeGreaterThan(0))
  stop()
})

it("classifies a new folder and creates a new chapter", async () => {
  const result = await classifyUnassigned(snapshotWithUnassigned, fakeMentor)
  expect(result.chapters.some(c => c.title === "Инструменты")).toBe(true)
  expect(readChapters().some(c => c.lessonIds.includes("new-topic"))).toBe(true)
})

it("leaves a folder unassigned on invalid classification", async () => {
  const result = await classifyUnassigned(snapshotWithUnassigned, badMentor)
  expect(result.unassigned).toContain("new-topic")
  expect(readChapters().flatMap(c => c.lessonIds)).not.toContain("new-topic")
})

it("does not relock progress when structure changes", () => {
  const access = computeAccess(snapshotWithNewFolder, [available("02-variables-types")], [])
  expect(access.lessons["02-variables-types"]).toBe("available")
})
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npx vitest run server/content/classify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать watcher, SSE и классификацию**

Watcher игнорирует `data/**`, `.superpowers/**`, `node_modules/**`. SSE `/api/events` отправляет `course:changed`. Классификация — фоновая, не блокирует; валидирует JSON; при ошибке папка остаётся `unassigned`; кнопка «Распределить ещё раз». `NewMaterialBanner` показывает статус.

- [ ] **Step 4: Проверить тесты**

Run: `npx vitest run server/content/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/content server/routes/events.ts src/features/course
git commit -m "feat: hot reload and folder classification"
```

### Task 19a: Контент «Инструменты»: терминал, скрипты, файловая система

**Files:**
- Create: `lessons/terminal-basics/README.md`, `lessons/terminal-basics/quiz.json`, `lessons/terminal-basics/tasks/*`
- Create: `lessons/scripting/README.md`, `lessons/scripting/quiz.json`, `lessons/scripting/tasks/*`
- Create: `lessons/filesystem/README.md`, `lessons/filesystem/quiz.json`, `lessons/filesystem/tasks/*`
- Modify: `course/chapters.json`, `course/chapter-quizzes/tools.json`

**Interfaces:**
- Produces: три полных урока и квиз главы; все квизы 50/50.

- [ ] **Step 1: Написать валидатор контента как тест**

```ts
it("validates every lesson and chapter quiz", () => {
  const course = scanCourse(projectRoot)
  expect(course.errors).toEqual([])
  for (const lesson of Object.values(course.lessons)) {
    expect(lesson.tasks.length).toBeGreaterThan(0)
    expect(lesson.quiz).not.toBeNull()
    expect(countTypes(lesson.quiz!)).toEqual({ single: 2, text: 2 })
  }
  for (const chapter of course.chapters) {
    expect(countTypes(chapter.quiz!)).toEqual({ single: 3, text: 3 })
  }
})
```

- [ ] **Step 2: Написать теорию и задания**

`terminal-basics`: устройство терминала, команды `pwd/ls/cd/mkdir/rm/cp/mv`, PATH, запуск `lua file.lua`, аргументы, пайпы, редиректы, коды возврата. Задания — `kind: "terminal"`: навигация по папкам, создание файлов, запуск скрипта, пайпы и редиректы.
`scripting`: shebang, `arg`, stdin/stdout/stderr, `os.exit`, обработка ошибок, скрипт-автоматизация. Задания — CLI-скрипты.
`filesystem`: `io.open`, режимы, `os.rename/remove`, пути, обход каталога, метаданные, безопасная запись. Задания — чтение/запись, копирование, отчёт по файлам.

- [ ] **Step 3: Написать квизы 2+2 и квиз главы 3+3**

- [ ] **Step 4: Обновить `course/chapters.json` и проверить валидатор**

Run: `npx vitest run server/content/content.test.ts`
Expected: PASS для новых глав.

- [ ] **Step 5: Commit**

```bash
git add lessons/terminal-basics lessons/scripting lessons/filesystem course
git commit -m "content: add tools chapter"
```

### Task 19b: Контент «Графика и игры»: LÖVE 2D

**Files:**
- Create: `lessons/love2d-basics/README.md`, `lessons/love2d-basics/quiz.json`, `lessons/love2d-basics/tasks/*`
- Create: `lessons/love2d-arcade/README.md`, `lessons/love2d-arcade/quiz.json`, `lessons/love2d-arcade/tasks/*`
- Modify: `course/chapters.json`, `course/chapter-quizzes/graphics.json`

**Interfaces:**
- Produces: два LÖVE-урока; задания `kind: "love"`.

- [ ] **Step 1: Написать теорию**

`love2d-basics`: установка LÖVE, `love.load/update/draw`, координаты, цвета, фигуры, текст, анимация, ввод. Список поддерживаемого подмножества в предпросмотре.
`love2d-arcade`: delta time, коллизии, спрайты, звук, состояния, мини-игра.

- [ ] **Step 2: Написать LÖVE-задания с `task.json`**

```json
{
  "title": "Движущийся круг",
  "entry": "main.lua",
  "files": ["main.lua"],
  "kind": "love",
  "timeoutMs": 3000
}
```

- [ ] **Step 3: Написать квизы 2+2 и квиз главы 3+3**

- [ ] **Step 4: Проверить валидатор и предпросмотр**

Run: `npx vitest run server/content/content.test.ts src/features/practice/love/love.test.ts`
Expected: PASS. Затем открыть задание и увидеть фигуры на canvas.

- [ ] **Step 5: Commit**

```bash
git add lessons/love2d-basics lessons/love2d-arcade course
git commit -m "content: add love2d graphics chapter"
```

### Task 19c: Квизы существующих уроков, метаданные 07, финальный проект

**Files:**
- Create: `lessons/01-hello-lua/quiz.json` … `lessons/12-final-project/quiz.json`
- Create: `lessons/07-modules/tasks/task{1,2,3}_*/README.md`, `task.json`
- Create: `lessons/12-final-project/tasks/project/{README.md,task.json,main.lua}`
- Create: `course/chapter-quizzes/{foundations,functions-and-data,advanced-lua,final-project}.json`
- Modify: `course/chapters.json`

**Interfaces:**
- Produces: полный контент курса; `scanCourse(projectRoot).errors` пуст.

- [ ] **Step 1: Добавить `quiz.json` во все 12 существующих папок**

По 2 теста + 2 письменных вопроса из теории. Квизы глав: 3+3.

- [ ] **Step 2: Дополнить 07 метаданными**

`task1_calc/task.json` (`entry: main.lua`, `files: [main.lua, calc.lua]`), README с заданием из комментариев. То же для `task2_todo` и `task3_plugin` (включая `plugins/*.lua`).

- [ ] **Step 3: Добавить проектное задание**

`lessons/12-final-project/tasks/project/` с `task.json` (`kind: "project"`, `entry: main.lua`), стартовым `main.lua` и README. `choose_project.lua` остаётся этапом 0.

- [ ] **Step 4: Проверить весь контент**

Run: `npx vitest run server/content/content.test.ts`
Expected: PASS: 17 уроков, 6 глав, 0 ошибок, все квизы 50/50.

- [ ] **Step 5: Commit**

```bash
git add lessons course
git commit -m "content: complete quizzes, module metadata and final project"
```

### Task 20: E2E, лаунчер и документация

**Files:**
- Create: `e2e/course.spec.ts`, `e2e/practice.spec.ts`, `e2e/mentor.spec.ts`, `playwright.config.ts`
- Create: `scripts/start.sh`, `README.md` (раздел «Как запускать»)

**Interfaces:**
- Produces: рабочий локальный запуск `./scripts/start.sh`, e2e-набор.

- [ ] **Step 1: Написать e2e-сценарий прохождения**

```ts
test("pass lesson 02 and unlock 03", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: /Переменные и типы/ }).click()
  await page.getByRole("tab", { name: "Вопросы" }).click()
  // ответить на 4 вопроса
  await page.getByRole("tab", { name: "Практика" }).click()
  await page.getByRole("button", { name: "Проверить" }).click()
  await page.getByRole("button", { name: "Сдать урок" }).click()
  await expect(page.getByText("Оценка")).toBeVisible()
})
```

Тест использует мок-учителя (`MENTOR_MODE=mock`), который возвращает валидный JSON с `grade: 4`; отдельный smoke-тест с реальным OpenCode помечается `test.slow()` и запускается вручную.

- [ ] **Step 2: Написать e2e тёмной темы, LSP и LÖVE**

- переключить тёмную тему, проверить `data-theme="dark"` и контраст заголовка;
- открыть практику, ввести `local = 1`, дождаться диагностики;
- открыть LÖVE-задание, увидеть непустой canvas;
- закрыть вкладку, дождаться `study_sessions.status = completed` в тестовой БД.

- [ ] **Step 3: Реализовать `scripts/start.sh`**

Скрипт: проверить Node/Lua/`lua-language-server`, установить зависимости при необходимости, собрать, запустить сервер на 4173, открыть браузер. Понятные ошибки, если чего-то нет; LSP и LÖVE-предпросмотр не обязательны для запуска.

- [ ] **Step 4: Прогнать всё**

Run: `npm run test && npm run typecheck && npm run test:e2e`
Expected: PASS. Затем вручную: светлая/тёмная тема, LSP, предпросмотр LÖVE, сдача с моком, отчёт занятия.

- [ ] **Step 5: Визуальная проверка**

Скриншоты: главная с сайдбаром, урок теория, вопросы, практика, разбор, успеваемость, отчёт, светлая и тёмная тема. Проверить, что нет обрезанного текста и пустых областей.

- [ ] **Step 6: Commit**

```bash
git add e2e playwright.config.ts scripts README.md
git commit -m "test: add e2e suite and launcher"
```

## Self-Review

**1. Spec coverage:** все разделы спецификации покрыты: контент и парсер (Tasks 3, 19), доступ (4, 14, 15), UI A и темы (6, 7, 17), редактор (9), раннер (10), LSP (11), LÖVE (12, 19b), учитель и защита от кода (13), попытки и сдача (14), квиз главы и чат (15), сессии и отчёты (16), горячая загрузка и классификация (18), новые темы (19a, 19b), запуск и e2e (20).

**2. Step scan:** каждый шаг — одно действие с проверкой; код-блоки содержат сигнатуры, тесты и точные значения, а не готовые тела.

**3. Type consistency:** `CourseSnapshot`, `TaskContent`, `Quiz`, `AccessState`, `RunResult`, `MentorReviewResult`, `ClassificationResult` используются одинаково во всех задачах; маршруты и имена файлов совпадают.

**4. Review Focus:** битый контент — Task 3; бесконечный Lua — Task 10; LSP недоступен — Task 11; учитель-мусор/готовый код — Task 13; новая папка — Task 18.

**5. Proportion:** план соизмерим со спецификацией; основная длина — тесты и интерфейсы, не транскрипт реализации.
