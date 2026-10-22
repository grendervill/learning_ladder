# Learning Ladder — курсы, папка проекта и конструктор: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить локальный курс «Лестница Lua» в «Лестницу обучения»: карточки курсов с поиском и пагинацией, настраиваемая папка проекта, настройки внутри каждого курса, конструктор курсов на ИИ и три режима практики (квиз 50/50, математические шаги, код с запуском и LSP).

**Architecture:** Один Node/Express-сервер и React-клиент. Курсы хранятся в `<project>/courses/<id>/`: встроенный Lua — `course.json` + `course/` + `lessons/`, сгенерированные — `course.json` + `mentor.md`. Сервер при смене проекта делает `chdir` в новый корень, переоткрывает SQLite и пересобирает снимок курсов; код приложения и `dist` остаются в исходной папке репозитория. Конструктор и наставник ходят в выбранную модель через общий LLM-слой; для OpenCode каждый запрос идёт в отдельной сессии с нейтральным агентом.

**Tech Stack:** Node 26, TypeScript, Express 5, `node:sqlite`, `chokidar`, `ws`, React 19, Vite, React Router, TanStack Query, CodeMirror 6 (`@codemirror/lang-cpp`, `lang-python`, `lang-javascript`), `@codemirror/lsp-client`, `katex`, `zod`, Lucide, Vitest, Testing Library, Playwright, Tauri 2.

**Spec:** `docs/superpowers/specs/2026-10-22-learning-ladder-multi-course-design.md`

## Global Constraints

- Только локальный запуск: сервер слушает `127.0.0.1`, данные не уходят наружу.
- Папка проекта по умолчанию — текущий репозиторий. Смена папки не изменяет старую папку.
- `lessons/` и `course/` переезжают в `courses/lua/`; ID уроков и глав не меняются, прогресс сохраняется.
- Глобальные настройки — только программа; всё курсовое (наставник, LSP, запуск, тема) — в настройках курса.
- Порог сдачи — 4.
- Гуманитарный курс: практика — квиз 50/50 (равное число `single` и `text`, минимум 4 вопроса).
- Математика: шаги `{formula, explanation}` + финальный ответ; формулы в LaTeX с палитрой и KaTeX-предпросмотром.
- Программирование: квиз + код, запуск и LSP по настройкам курса; пресеты Lua/C/C++/Python/JavaScript.
- Промпт наставника курса попадает только в запросы этого курса; свежая OpenCode-сессия на каждый запрос.
- Промпт конструктора — системная инструкция, JSON-схемы проверяются кодом; пользователь не может сломать схему.
- Все тексты интерфейса на русском, sentence case; иконки Lucide; темы light/dark.
- Каждая UI-задача заканчивается скриншотом светлой и тёмной темы.
- Каждая задача заканчивается коммитом; `npm test`, `npm run typecheck` — перед коммитом.
- `data/`, `reports/`, `dist/`, `src-tauri/target/` не коммитятся.

## Review Focus

1. **Пустая или чужая папка проекта.** Нет `courses/`, нет прав, путь не существует. Ожидание: понятная ошибка, старая папка не тронута, интерфейс не зависает. Тест — Task 4.
2. **Битый или неполный ответ конструктора.** Невалидный JSON, нет уроков, квиз не 50/50. Ожидание: повтор, затем ошибка в мастере, курс не появляется на главной. Тест — Task 8.
3. **Код на C/Python с ошибкой компиляции или бесконечным циклом.** Ожидание: stderr компилятора виден, процесс убивается по таймауту, редактор и файлы целы. Тест — Task 12.
4. **Смешивание наставников.** Экономика не должна видеть правила Lua. Ожидание: в запросе только промпт своего курса; свежая сессия. Тест — Task 7.
5. **Практика без заданий и математические шаги.** Гуманитарный урок сдаётся без `tasks`; пустые шаги/формулы не ломают отправку. Ожидание: валидация и понятная ошибка. Тест — Task 10/11.

---

### Task 1: Папка проекта, конфиг и раскладка

**Files:**
- Create: `server/project.ts`
- Create: `server/project.test.ts`
- Modify: `server/db/index.ts`
- Modify: `server/context.ts`

**Interfaces:**
- Consumes: `process.cwd()`, `os.homedir()`, `node:fs`.
- Produces:
  - `interface ProjectPaths { root, dataDir, settingsPath, dbPath, workspacesDir, coursesDir, promptsDir, reportsDir, constructorPromptPath, configPath }`
  - `appConfigPath(): string`
  - `resolveProjectPaths(root: string): ProjectPaths`
  - `readConfiguredProjectRoot(fallback: string): string`
  - `writeConfiguredProjectRoot(root: string): void`
  - `ensureProjectLayout(root: string): ProjectPaths` — создаёт `data/`, `courses/`, `prompts/`, `reports/`, `data/workspaces/`; пишет дефолтные агенты OpenCode.
  - `migrateLegacyLua(root: string): boolean` — переносит `lessons/` и `course/` в `courses/lua/`, создаёт `course.json` и `mentor.md`, если их нет.
  - `closeDb(): void` в `server/db/index.ts`.

- [ ] **Step 1: Write failing tests** for default root, config round-trip, layout creation, migration idempotency, invalid path.
- [ ] **Step 2: Run** `npx vitest run server/project.test.ts` — FAIL.
- [ ] **Step 3: Implement** `server/project.ts` and `closeDb`; use `renameSync` for migration and preserve files on failure.
- [ ] **Step 4: Run tests** — PASS; run `npm run typecheck`.
- [ ] **Step 5: Commit** `feat: add project root config and migration`.

### Task 2: Мультикурсовый снимок и сканер папок курсов

**Files:**
- Modify: `server/content/types.ts`
- Modify: `server/content/scan.ts`
- Create: `server/content/courses.ts`
- Create: `server/content/courses.test.ts`
- Modify: `server/context.ts`
- Move: `lessons/` → `courses/lua/lessons/`, `course/` → `courses/lua/course/`

**Interfaces:**
- Consumes: `ProjectPaths`, `scanCourse(courseDir)`.
- Produces:
  - `type CourseMode = "general" | "math" | "programming"`
  - `type RuntimeKind = "none" | "lua" | "c" | "cpp" | "python" | "javascript" | "custom"`
  - `interface CourseSettings { runtime, runCommand, lspCommand, lspArgs, fileExtension, entry }`
  - `interface CourseMeta { id, title, description, theme, icon, mode, settings, builtIn, createdAt }`
  - `CourseSnapshot` gains `courses: CourseMeta[]`; `Chapter`/`LessonContent` gain optional `courseId`.
  - `scanProject(root: string): CourseSnapshot` — обходит `courses/*`, читает legacy и generated форматы, валидирует, собирает плоские chapters/lessons.
  - `writeGeneratedCourse(root, course): void` — атомарная запись `courses/<id>/course.json`.
  - `readMentorPrompt(root, courseId): string`, `writeMentorPrompt(root, courseId, body): void`.

- [ ] **Step 1: Write failing tests** for two courses in the snapshot, generated JSON validation, legacy Lua migration, unique IDs, broken course errors, mentor prompt round-trip.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** `courses.ts`, extend types, refactor `scanCourse` to be callable per course folder, move the Lua dirs, create `courses/lua/course.json` + `courses/lua/mentor.md`.
- [ ] **Step 4: Run** `npx vitest run server/content/courses.test.ts` and the existing content tests; update README links with `perl` only after tests pass.
- [ ] **Step 5: Commit** `feat: load multiple courses from course folders`.

### Task 3: Доступ по курсам и API курсов

**Files:**
- Modify: `server/access.ts`
- Modify: `server/access-data.ts`
- Create: `server/routes/courses.ts`
- Modify: `server/routes/course.ts`
- Modify: `server/routes/submit.ts`, `run.ts`, `quiz.ts`, `chapter-quiz.ts`, `mentor-ask.ts`
- Create: `server/routes/courses.test.ts`
- Modify: `server/app.ts`

**Interfaces:**
- Consumes: `scanProject`, `CourseSnapshot`, `computeAccess`.
- Produces:
  - `courseAccess(db, snapshot, courseId): AccessState`
  - `courseSummary(snapshot, db, courseId): { passed, total, percent, nextLessonId }`
  - `GET /api/courses?query=&page=&pageSize=25` → `{ courses, total, page, pageSize, pages }`
  - `GET /api/courses/:id` → `{ course, chapters, lessons, access, errors }`
  - `GET /api/courses/:id/settings`, `PUT /api/courses/:id/settings`
  - `GET/PUT /api/courses/:id/mentor-prompt`
  - Old `/api/course`, `/api/lessons/:id` keep working; lessons determine their course.

- [ ] **Step 1: Write failing tests** for search/pagination (25 max), course detail, course settings, mentor prompt, Lua lesson access, generated chapter auto-unlock vs Lua quiz gate.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** access scoping, the chapter auto-pass rule (`allLessonsPassed && (!chapter.quiz || quiz passed)`), routes, and app wiring.
- [ ] **Step 4: Run** `npx vitest run server/routes/courses.test.ts server/access.test.ts`; fix existing route tests.
- [ ] **Step 5: Commit** `feat: add course-scoped access and courses api`.

### Task 4: Переключение папки проекта

**Files:**
- Modify: `server/context.ts`
- Modify: `server/db/index.ts`
- Modify: `server/index.ts`
- Modify: `server/content/watcher.ts`
- Create: `server/project-controller.ts`
- Create: `server/routes/project.ts`
- Create: `server/routes/project.test.ts`

**Interfaces:**
- Consumes: `ensureProjectLayout`, `migrateLegacyLua`, `closeDb`, `defaultContext`, `startContentWatcher`.
- Produces:
  - `ProjectController` with `current(): AppContext`, `switch(root): Promise<{ root, courses }>`.
  - `GET /api/project` → `{ root, courses, exists, writable }`.
  - `PUT /api/project` `{ root }` → validates, creates layout, `chdir`, closes/reopens DB, rebuilds snapshot, restarts watcher, emits `project:changed`.
  - `createApp({ getContext, staticRoot })` reads the current context; static assets always from `staticRoot` (code repo).

- [ ] **Step 1: Write failing tests** for switch to empty folder, invalid/non-writable path, old folder unchanged, project API shape.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** `project-controller.ts`, `routes/project.ts`, reset DB/context/watcher; capture `staticRoot` at startup.
- [ ] **Step 4: Run** project tests and `npm test`; verify `/api/health` on a temp project.
- [ ] **Step 5: Commit** `feat: switch project folder at runtime`.

### Task 5: Главная с карточками, поиск, пагинация и пустое состояние

**Files:**
- Create: `src/features/courses/CourseCard.tsx`
- Create: `src/features/courses/CourseCard.css`
- Create: `src/features/courses/CoursesHome.tsx`
- Create: `src/features/courses/CoursesHome.css`
- Create: `src/features/courses/CoursePage.tsx` (move/adapt current `CourseHome.tsx`)
- Create: `src/lib/useCourses.ts`
- Modify: `src/app/router.tsx`, `src/app/AppShell.tsx`, `src/components/Sidebar.tsx`
- Modify: `src/components/Sidebar.css`, `src/lib/useCourse.ts`, `src/lib/types.ts`
- Modify: `src/features/lesson/LessonPage.tsx`, `src/features/chapter/ChapterQuizPage.tsx`
- Create: `src/features/courses/CoursesHome.test.tsx`
- Modify: `e2e/course.spec.ts`

**Interfaces:**
- Consumes: `/api/courses`, `/api/courses/:id`, `/api/project`.
- Produces:
  - `useCourses(query, page)`, `useCourse(courseId)`.
  - Routes: `/` (cards), `/courses/:courseId`, `/courses/:courseId/lessons/:lessonId`,
    `/courses/:courseId/chapters/:chapterId/quiz`, `/courses/:courseId/settings`.
  - Card component props `{ course, index }`; CSS variables `--mx`, `--my`, `--rx`, `--ry` set on pointer move; no React re-render per move.
  - Empty state with project path + «Изменить папку проекта».

- [ ] **Step 1: Write failing component test** for card title/description/progress, search filtering through mocked API, 25-per-page pagination, empty banner.
- [ ] **Step 2: Run** `npx vitest run src/features/courses/CoursesHome.test.tsx` — FAIL.
- [ ] **Step 3: Implement** hooks, cards, glow/tilt, search (debounced), pagination, empty state, course page, sidebar context, routes and links; rename the sidebar/home brand to «Лестница обучения» and keep `useCourse(courseId?)` working for the performance page until Task 14.
- [ ] **Step 4: Run** tests + `npm run test:e2e`; update course e2e to open the Lua card first.
- [ ] **Step 5: Visual check** screenshots light/dark + hover; then commit `feat: add course cards, search and pagination`.

### Task 6: Настройки — проект, конструктор, настройки курса

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`, `.css`, `ChecksTab.tsx`, `MentorTab.tsx`, `NetworkTab.tsx`
- Create: `src/features/settings/ProjectTab.tsx`
- Create: `src/features/settings/ConstructorTab.tsx`
- Create: `src/features/settings/CourseSettingsPage.tsx` + `.css`
- Create: `src/lib/project.ts`, `src/lib/constructor.ts`
- Modify: `server/routes/settings.ts`, `server/routes/checks.ts` (or settings checks), `server/app.ts`
- Create: `src/features/settings/ProjectTab.test.tsx`

**Interfaces:**
- Consumes: `/api/project`, `/api/constructor-prompt`, `/api/courses/:id/settings`, `/api/courses/:id/mentor-prompt`, `/api/courses/:id/checks`.
- Produces:
  - Global tabs: Проверки, Нейросеть, Создать курс, Конструктор, Папка проекта.
  - Project tab: path, change button (text input; native Tauri picker added in Task 14), course count.
  - Constructor tab: textarea, save/reset, char count; `server/courses/prompts.ts` default and `GET/PUT /api/constructor-prompt` (the prompt is the system instruction; JSON schemas live in Task 8).
  - Course settings page: general (title/description/theme/icon), mentor prompt, practice mode/runtime/LSP/run, course checks.
  - `GET/PUT /api/constructor-prompt`; `GET /api/courses/:id/checks`.

- [ ] **Step 1: Write failing test** for project tab path/change and constructor prompt save; course settings form validation.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** endpoints, tabs, course settings page, remove global «Наставник» tab, add links from course page/sidebar.
- [ ] **Step 4: Run** tests + typecheck; visual check settings light/dark.
- [ ] **Step 5: Commit** `feat: add project and per-course settings`.

### Task 7: Общий LLM-слой и изоляция наставников

**Files:**
- Modify: `server/mentor/client.ts`, `server/mentor/service.ts`, `server/mentor/types.ts`
- Create: `server/mentor/agents.ts` or default agent files
- Create: `.opencode/agents/course-mentor.md`, `.opencode/agents/course-constructor.md`
- Create: `server/mentor/scoping.test.ts`
- Modify: `server/routes/submit.ts`, `mentor-ask.ts`, `session/summary`
- Modify: `server/sessions/lifecycle.ts`

**Interfaces:**
- Consumes: settings network, course prompt.
- Produces:
  - `generateWithAgent({ agent, system, prompt, timeoutMs }): Promise<string>` — OpenCode fresh session or direct provider.
  - `MentorReviewRequest.mentorPrompt`, `MentorContext.mentorPrompt`; prompt prepends course rules.
  - `createMentorSession(title, agent = "course-mentor")`.
  - `acquireMentorSession` creates a fresh session per call and releases/deletes it; summary uses a fresh session too.
  - `getCourseMentorPrompt(snapshot, courseId)`.

- [ ] **Step 1: Write failing tests** with a fake `generate` capturing prompts: Lua request contains Lua prompt, economics request contains only economics prompt; no shared session.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** generic generation, prompt injection, fresh sessions, neutral agents; adapt review/ask/summary.
- [ ] **Step 4: Run** mentor/service tests + `npm test`.
- [ ] **Step 5: Commit** `feat: isolate mentors per course`.

### Task 8: Конструктор — уточнение и генерация курса

**Files:**
- Create: `server/courses/prompts.ts` (task prompts; the editable system prompt is stored in Task 6)
- Create: `server/courses/schema.ts` (zod: clarify, outline, lesson, course)
- Create: `server/courses/generator.ts`
- Create: `server/courses/jobs.ts`
- Create: `server/routes/course-builder.ts`
- Create: `server/courses/generator.test.ts`
- Create: `server/routes/course-builder.test.ts`
- Modify: `server/app.ts`, `server/context.ts`

**Interfaces:**
- Consumes: `generateWithAgent`, selected network, `writeGeneratedCourse`, `writeMentorPrompt`, `ProjectController`.
- Produces:
  - `POST /api/courses/clarify` `{ topic }` → `{ questions: [{ id, prompt, type: "single"|"multiple", options }], fallback?: boolean }`.
  - `POST /api/courses/generate` `{ topic, answers, volume }` → `{ jobId }`.
  - `GET /api/courses/jobs/:id` → `{ status, phase, completed, total, title?, courseId?, error? }`.
  - `POST /api/courses/jobs/:id/cancel`.
  - Default constructor prompt: style, card rules, mentor guidance; JSON schemas enforced by code.
  - Course generation: outline (meta/theme/icon/mode/settings/mentor prompt/chapters/lesson titles), then lesson content; validate 50/50 for general; retry once; save `course.json` + `mentor.md`; refresh snapshot; emit `course:changed`.
  - Volume: short 2–3, medium 4–6, long 8–12+.

- [ ] **Step 1: Write failing tests** for clarify JSON/fallback, invalid outline retry, 50/50 validation, lesson generation, job progress/cancel, course saved and visible.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** prompts/schemas/generator/jobs/routes; wire into app.
- [ ] **Step 4: Run** `npx vitest run server/courses server/routes/course-builder.test.ts`.
- [ ] **Step 5: Commit** `feat: generate courses with the constructor`.

### Task 9: Мастер создания курса

**Files:**
- Create: `src/features/courses/CourseWizard.tsx` + `.css`
- Create: `src/features/courses/CourseWizardProvider.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`, `src/features/courses/CoursesHome.tsx`, `src/app/AppShell.tsx`
- Create: `src/features/courses/CourseWizard.test.tsx`
- Create: `e2e/course-builder.spec.ts`

**Interfaces:**
- Consumes: `/api/courses/clarify`, `/api/courses/generate`, `/api/courses/jobs/:id`.
- Produces:
  - `openCourseWizard()` from home and «Создать курс» tab.
  - Steps: topic → clarify (AI options with checkboxes/custom + volume) → generation progress → done.
  - Polling every 1s; cancel button; retry on error; on success invalidate `["courses"]` and link to `/courses/:id`.
  - Fallback clarification questions if API fails.

- [ ] **Step 1: Write failing tests** for step transitions, volume selection, cancel, success navigation.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** modal/provider, API calls, polling, focus trap, Esc handling.
- [ ] **Step 4: Run** tests + e2e with mocked generation.
- [ ] **Step 5: Visual check** wizard light/dark; commit `feat: add course creation wizard`.

### Task 10: Практика-квиз 50/50 для гуманитарных курсов

**Files:**
- Modify: `server/content/types.ts`, `server/content/scan.ts`, `server/content/courses.ts`
- Modify: `server/routes/submit.ts`
- Modify: `src/features/lesson/LessonPage.tsx`
- Modify: `src/features/quiz/QuizTab.tsx`, `QuizTab.css`
- Create: `src/features/quiz/QuizPractice.tsx`
- Create/Modify tests: `server/routes/submit.test.ts`, `src/features/quiz/QuizPractice.test.tsx`

**Interfaces:**
- Consumes: course `mode`, lesson quiz, SubmitPanel.
- Produces:
  - General lesson: tabs Theory + Practice; Practice renders the lesson quiz (single + text) with `Сдать урок`.
  - Submit allows no `tasks` when `lesson.quiz` exists and course mode is general; mentor review receives quiz answers, tasks empty.
  - Validation: at least 4 questions, equal single/text (difference ≤ 1) for general courses.

- [ ] **Step 1: Write failing tests** for tabs without «Вопросы», submit without tasks, 50/50 validation, open answers review.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** UI/route changes.
- [ ] **Step 4: Run** tests + visual check.
- [ ] **Step 5: Commit** `feat: add 50/50 quiz practice for general courses`.

### Task 11: Математические шаги и редактор формул

**Files:**
- Modify: `server/content/types.ts` (`TaskKind: "steps"`), `server/content/tasks.ts` or generated course loader
- Modify: `server/mentor/service.ts` (format steps in review prompt)
- Modify: `src/features/practice/PracticeTab.tsx`
- Create: `src/features/practice/StepsPractice.tsx` + `.css`
- Create: `src/features/practice/FormulaField.tsx` + `.css`
- Modify: `package.json` (add `katex`)
- Create tests: `StepsPractice.test.tsx`, `server/mentor/steps.test.ts`

**Interfaces:**
- Consumes: task kind `steps`, `solution.json`.
- Produces:
  - `StepsPractice` loads/saves `solution.json` `{ steps: [{ formula, explanation }], answer }`.
  - Formula palette (fraction, power, root, integral, sum, Greek, derivative) and KaTeX preview.
  - Submit validates non-empty steps; mentor receives formatted steps and checks process.
- [ ] **Step 1: Write failing tests** for adding/removing steps, saving JSON, formula preview, empty-step validation, review prompt.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** task kind, UI, KaTeX, review formatting.
- [ ] **Step 4: Run** tests + visual check math lesson.
- [ ] **Step 5: Commit** `feat: add step-by-step math practice`.

### Task 12: Рантаймы и запуск кода для курсов

**Files:**
- Create: `shared/runtimes.ts` (presets, themes, icons)
- Create: `server/run/runner.ts` (generic)
- Modify: `server/routes/run.ts`, `server/routes/task-files.ts`
- Modify: `server/routes/settings.ts` (course checks)
- Modify: `src/features/practice/CodeEditor.tsx`, `RunPanel.tsx`
- Modify: `src/features/practice/PracticeTab.tsx`
- Create tests: `server/run/runner.test.ts`, `src/features/practice/Runtime.test.tsx`
- Modify: `package.json` (`@codemirror/lang-cpp`, `lang-python`, `lang-javascript`)

**Interfaces:**
- Consumes: course settings `runtime`, `runCommand`, `fileExtension`, `entry`.
- Produces:
  - `RUNTIME_PRESETS` shared list; `runtimeFor(course)`.
  - `runTask({ files, entry, command, args, stdin, timeoutMs })` runs `bash -lc` with `{file}`, `{bin}`, `{dir}`; returns stdout/stderr/exit/timedOut.
  - C: compile + run; Python/JS/Lua presets; compiler errors visible.
  - `CodeEditor` language prop (lua/c/cpp/python/javascript).
  - Course settings runtime checks (`gcc`, `clangd`, etc.).

- [ ] **Step 1: Write failing tests** for command substitution, C compile error, timeout, Python success, course runtime lookup.
- [ ] **Step 2: Run** tests — FAIL.
- [ ] **Step 3: Implement** generic runner, route changes, editor language maps, checks.
- [ ] **Step 4: Run** tests; manual run of C task.
- [ ] **Step 5: Commit** `feat: add per-course runtimes and code execution`.

### Task 13: LSP по курсам

**Files:**
- Modify: `server/lsp/server.ts`, `server/lsp/bridge.ts`
- Modify: `src/features/practice/LspProvider.tsx`
- Modify: `src/features/practice/CodeEditor.tsx`, `PracticeTab.tsx`, `LspStatus.tsx`
- Create: `server/lsp/course-lsp.ts` + test
- Modify: `src/lib/useLesson.ts` / lesson API (`courseId`, `runtime`)

**Interfaces:**
- Consumes: WebSocket `/lsp?courseId=<id>`, course settings LSP command/args.
- Produces:
  - Server resolves the course, spawns its LSP with cwd = course folder; passes command/args.
  - Client connects with `courseId`; document URI includes course ID; status per course.
  - Missing LSP → status «LSP недоступен», editor/run still work.

- [ ] **Step 1: Write failing test** for bridge options from course settings and graceful missing binary.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** query parsing, bridge options, client prop/URI changes.
- [ ] **Step 4: Run** tests + manual C/Lua LSP check.
- [ ] **Step 5: Commit** `feat: scope lsp to courses`.

### Task 14: Успеваемость, сессии, финальная сборка и Tauri

**Files:**
- Modify: `src/features/performance/PerformancePage.tsx`, `GradeTable.tsx`, `src/lib/useProgress.ts`
- Modify: `server/routes/progress.ts`, `server/sessions/lifecycle.ts`, `server/mentor/prompts`
- Modify: `src-tauri/tauri.conf.json`, `package.json`, `README.md`, `index.html`
- Add: `@tauri-apps/plugin-dialog`, `tauri-plugin-dialog` (register in `src-tauri/src/main.rs` + `Cargo.toml`), capabilities
- Modify: `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`
- Create: `src/lib/projectPicker.ts`
- Modify: `src/features/settings/ProjectTab.tsx`, `CoursesHome.tsx` change-folder button
- Tests: performance grouping, session summary, project picker fallback
- Rebuild `.app`/DMG and replace `/Applications/Лестница Lua.app` with `Лестница обучения.app`

**Interfaces:**
- Consumes: `useCourses`, `/api/progress`, `/api/project`.
- Produces:
  - Performance grouped/filterable by course; course title on attempts.
  - Session stats include courses; neutral summary prompt with per-course sections.
  - Tauri dialog `open({ directory: true })`; browser fallback path input.
  - Brand rename everywhere; old app removed.
  - Final e2e/typecheck/build/Tauri build; screenshots.

- [ ] **Step 1: Write failing tests** for per-course performance and project picker fallback.
- [ ] **Step 2: Implement** performance/session changes, brand rename, dialog plugin, Tauri config.
- [ ] **Step 3: Run** unit/e2e/typecheck/build.
- [ ] **Step 4: Build Tauri, install, cold-start test, screenshot app.**
- [ ] **Step 5: Commit** `feat: finish multi-course learning ladder and desktop app`.

## Self-Review Notes

- All spec sections have a task: project folder (1/4), multi-course (2/3), cards/search/pagination/empty (5), settings (6), mentor isolation (7), constructor (8/9), 50/50 (10), math (11), runtimes (12), LSP (13), performance/Tauri (14).
- Types names are consistent: `CourseMeta`, `CourseSettings`, `RuntimeKind`, `CourseMode`, `ProjectPaths`, `courseAccess`, `scanProject`, `generateWithAgent`, `runTask`.
- Review Focus tests are mapped to Tasks 4, 8, 12, 7, 10/11.
- Out of scope is explicit: no course deletion, no manual lesson editing, no image generation, no OCR.
