# Вложения и переносимая папка проекта — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Починить смену папки проекта, добавить вложения в конструктор курсов и чат наставника с выбором «сохранить/удалить», выпустить 0.1.1.

**Architecture:** Новый слой `server/attachments` хранит временные файлы в `data/attachments/tmp`, извлекает текст из PDF/DOCX и отдаёт изображения модели. Конструктор и наставник получают вложения через `attachmentIds`; после использования файлы либо копируются в проект, либо удаляются. Папка проекта получает безопасный fallback и нативный выбор через Tauri remote-capability.

**Tech Stack:** Node 26, Express 5, TypeScript, React 19, Tauri 2, `multer`, `unpdf`, `mammoth`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-attachments-and-project-folder-design.md`

## Global Constraints

- Версия 0.1.1 во всех манифестах.
- Вложения: 5 файлов, 25 МБ на файл, 50 МБ суммарно; текст до 120 000 символов.
- Форматы: PNG/JPEG/WebP, PDF, DOCX, TXT/MD/CSV/JSON.
- Сканированные PDF без текста не поддерживаются.
- Сохранение вложений — по чекбоксу, по умолчанию выключено.
- Курс: `courses/<courseId>/materials/`; наставник: `data/attachments/mentor/<conversationId>/`.
- Существующая доступная папка проекта не мигрирует автоматически.
- В dev/тестах папка по умолчанию — `process.cwd()`; в desktop — `Documents/Лестница обучения`.

## Review Focus

- Файл с неверным расширением/MIME или слишком большой — должен получить понятную ошибку, а не уронить сервер.
- Имя файла с `../`, пробелами и кириллицей — не должно выйти за пределы папки вложений.
- Модель без vision при изображении — 400 с подсказкой, текстовые файлы при этом работают.
- Закрытие мастера/чата без отправки — временные файлы удаляются.
- Временный отключённый внешний диск — приложение стартует в fallback, но конфиг не теряет старую папку.

---

### Task 1: Папка проекта — серверный fallback и defaultRoot

**Files:**
- Modify: `server/project.ts`
- Modify: `server/index.ts`
- Modify: `server/app.ts`
- Modify: `server/routes/project.ts`
- Modify: `server/project-controller.ts`
- Test: `server/project.test.ts`, `server/routes/project.test.ts`

**Interfaces:**
- Produces: `projectRootCandidates(fallback: string): string[]`
- Produces: `ProjectStatus = { defaultRoot: string; activeRoot: string; configuredRoot: string; fallbackError?: string }`
- `GET /api/project` returns `{ root, courses, exists, writable, defaultRoot, isDefault, fallbackError? }`
- `PUT /api/project` success clears fallback error.

- [ ] Test `projectRootCandidates` order: configured path first, then fallback, then `home/Лестница обучения`, then cwd; no duplicates.
- [ ] Run test, expect fail.
- [ ] Implement `projectRootCandidates` and `resolveUsableProjectRoot` in `server/project.ts`.
- [ ] Update `startServer` to try candidates, use fallback without rewriting config, expose status.
- [ ] Update `createProjectRouter` and tests for `defaultRoot`/`fallbackError`.
- [ ] Run `npm test -- server/project.test.ts server/routes/project.test.ts`.
- [ ] Commit.

### Task 2: Tauri remote-capability и UI папки

**Files:**
- Create: `src-tauri/capabilities/remote.json`
- Modify: `src/lib/projectPicker.ts`
- Modify: `src/lib/useProject.ts`
- Modify: `src/features/settings/ProjectTab.tsx`
- Modify: `src/features/courses/CoursesHome.tsx`
- Test: `src/features/settings/ProjectTab.test.tsx`, `src/features/courses/CoursesHome.test.tsx`

**Interfaces:**
- `pickProjectFolder(): Promise<{ path: string | null; error?: string }>`
- `useProject` data adds `defaultRoot: string`, `isDefault: boolean`, `fallbackError?: string`.

- [ ] Test ProjectTab shows default path, fallback banner, native-picker error, and sends PUT for default.
- [ ] Run test, expect fail.
- [ ] Add remote capability with `dialog:allow-open` for `http://127.0.0.1:4173` and `http://localhost:5173`.
- [ ] Update picker to return errors instead of swallowing them.
- [ ] Update ProjectTab with «Папка по умолчанию», fallback banner and error text.
- [ ] Update CoursesHome to show picker error and navigate to settings.
- [ ] Run tests.
- [ ] Commit.

### Task 3: Слой вложений — хранение и извлечение текста

**Files:**
- Create: `server/attachments/types.ts`
- Create: `server/attachments/store.ts`
- Create: `server/attachments/parse.ts`
- Create: `server/attachments/prompt.ts`
- Create: `server/attachments/model-support.ts`
- Test: `server/attachments/store.test.ts`, `parse.test.ts`, `prompt.test.ts`, `model-support.test.ts`
- Fixtures: `server/attachments/__fixtures__/sample.pdf`, `sample.docx`

**Interfaces:**
- `createAttachment(root, file: UploadFile): Promise<StoredAttachment>`
- `readAttachments(root, ids: string[]): StoredAttachment[]`
- `deleteAttachments(root, ids: string[]): void`
- `keepCourseAttachments(root, courseId, ids): string[]`
- `keepMentorAttachments(root, conversationId, ids): string[]`
- `cleanupExpiredAttachments(root, maxAgeMs): number`
- `formatMaterials(attachments, limit?): string`
- `imageAttachments(attachments): ModelAttachment[]`
- `supportsImages(settings): Promise<boolean>`

- [ ] Add `multer`, `@types/multer`, `unpdf`, `mammoth`.
- [ ] Write failing tests for validation, safe filenames, PDF/DOCX text, truncation, keep/delete, cleanup.
- [ ] Run tests, expect fail.
- [ ] Implement types/store/parse/prompt/model-support.
- [ ] Run tests.
- [ ] Commit.

### Task 4: API вложений и конструктор курсов

**Files:**
- Create: `server/routes/attachments.ts`
- Modify: `server/app.ts`
- Modify: `server/routes/course-builder.ts`
- Modify: `server/courses/schema.ts`
- Modify: `server/courses/prompts.ts`
- Modify: `server/courses/generator.ts`
- Test: `server/routes/attachments.test.ts`, `server/routes/course-builder.test.ts`, `server/courses/generator.test.ts`

**Interfaces:**
- `POST /api/attachments` multipart `files` -> `{ attachments: StoredAttachment[] }`
- `DELETE /api/attachments/:id` -> `{ deleted: boolean }`
- `GenerateCourseInput` adds `materials?: string`, `images?: ModelAttachment[]`, `keepAttachments?: boolean`.
- `CourseGenerator.clarify(topic, materials?)`.
- Generator describes images once, includes text/descriptions in outline/lesson prompts, keeps or deletes attachments on success.

- [ ] Write failing route tests for upload limits/types/delete and course-builder payload.
- [ ] Write failing generator test: prompts include materials; images described once; keep copies to `courses/<id>/materials`; no keep deletes temp.
- [ ] Run tests, expect fail.
- [ ] Implement attachments route, app registration, course-builder parsing, generator integration.
- [ ] Run tests.
- [ ] Commit.

### Task 5: Вложения в чате наставника

**Files:**
- Modify: `server/mentor/types.ts`
- Modify: `server/mentor/client.ts`
- Modify: `server/mentor/providers.ts`
- Modify: `server/mentor/service.ts`
- Modify: `server/routes/mentor-ask.ts`
- Modify: `server/db/schema.ts`, `server/db/index.ts`
- Test: `server/routes/mentor-ask.test.ts`, `server/mentor/providers.test.ts`, `server/db/schema.test.ts`

**Interfaces:**
- `MentorContext.materials?: string`, `MentorContext.imageAttachments?: ModelAttachment[]`
- `GenerateWithAgentInput.attachments?: ModelAttachment[]`
- `generateMentorReply(sessionId, prompt, system?, attachments?)`
- `POST /api/mentor/ask` accepts `attachmentIds`, `keepAttachments`.
- `mentor_messages.attachments_json` migration.

- [ ] Write failing mentor-ask test: text material reaches prompt; images passed; keep saves under `data/attachments/mentor/<conversationId>`; no keep deletes; DB stores names.
- [ ] Write failing provider test for multimodal body builders.
- [ ] Run tests, expect fail.
- [ ] Implement types, OpenCode `session.prompt` + `wait` path, direct multimodal content, service/route integration, DB migration.
- [ ] Run tests.
- [ ] Commit.

### Task 6: UI вложений — AttachmentPicker, мастер, чат

**Files:**
- Create: `src/lib/attachments.ts`
- Create: `src/components/AttachmentPicker.tsx`
- Create: `src/components/AttachmentPicker.css`
- Modify: `src/features/courses/CourseWizard.tsx`, `CourseWizard.css`
- Modify: `src/features/mentor/MentorDrawer.tsx`, `MentorDrawer.css`
- Modify: `src/lib/courseBuilder.ts`
- Test: `src/components/AttachmentPicker.test.tsx`, `src/features/courses/CourseWizard.test.tsx`, `src/features/mentor/mentor.test.tsx`

**Interfaces:**
- `uploadAttachments(files: File[]): Promise<UploadedAttachment[]>`
- `deleteAttachment(id: string): Promise<void>`
- `prepareImage(file: File): Promise<File>`
- `AttachmentPicker` props: `attachments`, `onChange`, `keep`, `onKeepChange`, `disabled?`, `label?`.

- [ ] Load `frontend-design` skill before UI code.
- [ ] Write failing AttachmentPicker test: select file, upload, remove, keep checkbox.
- [ ] Write failing wizard test: payload includes attachment IDs and keep flag.
- [ ] Write failing mentor test: send includes IDs, shows file names, keep flag.
- [ ] Run tests, expect fail.
- [ ] Implement client helper, picker, wizard/chat integration and CSS.
- [ ] Run tests and typecheck.
- [ ] Visual check in browser; fix layout.
- [ ] Commit.

### Task 7: Версия 0.1.1, CI, README

**Files:**
- Modify: `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`
- Modify: `.github/workflows/desktop.yml`
- Modify: `README.md`

- [ ] Bump all versions to 0.1.1.
- [ ] Add CI `test` job (`npm ci`, `typecheck`, `npm test`); build jobs `needs: test`.
- [ ] Update README: project folder behavior, attachments/formats/limits, keep choice, version/release.
- [ ] Run `npm test`, `npm run typecheck`, `npm run test:e2e`.
- [ ] Build desktop app locally and visually check.
- [ ] Commit and push both remotes.
- [ ] Trigger `desktop.yml`; verify all 5 jobs and artifacts.
- [ ] Create GitHub Release `v0.1.1` with installers + `SHA256SUMS.txt`.
