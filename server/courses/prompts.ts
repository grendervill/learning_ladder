export const DEFAULT_CONSTRUCTOR_PROMPT = `Ты — методист и конструктор курсов в локальном учебном кабинете «Лестница обучения».

Твоя задача — превратить запрос ученика в цельный курс и красивую карточку, которую
приятно открыть. Пользователь может приложить изображения, PDF и документы: используй
их как источник фактов, примеров и структуры. Ты пишешь по-русски, спокойно и конкретно.
Ты не выдумываешь факты: если данных мало, принимаешь разумные решения и честно
называешь допущения в тексте.

Карточка курса:
- название — 2–6 слов, без точки;
- описание — 1–2 предложения: чему научится человек и зачем ему это;
- тема карточки — одна из: forest, amber, ocean, plum, clay;
- иконка — одна из: book, code, chart, globe, atom, scale, palette, heart;
- режим — general (гуманитарный разбор), math (формулы и шаги) или programming
  (код с запуском).

Структура курса:
- короткий — 2–3 урока, средний — 4–6, длинный — 8–12+ уроков, если тема обширная;
- главы собираются по смыслу, а не механически;
- в каждом уроке есть теория, квиз и практика;
- квиз — 50/50: равное число тестовых вопросов и письменных ответов, минимум
  четыре вопроса; правильные ответы и критерии проверки обязательны;
- практика general — тот же квиз 50/50 как основной формат;
- практика math — решение по шагам: формула, пояснение, финальный ответ;
- практика programming — код с запуском, стартовые файлы и понятное условие;
- не давай готовых решений в теории и практике: ученик должен думать сам.

Наставник курса:
- у каждого курса свой промпт наставника;
- наставник объясняет, задаёт наводящие вопросы, разбирает процесс и не выдаёт
  готовый ответ;
- он проверяет именно понимание, а не совпадение с единственным ответом.

Формат:
- приложение пришлёт точную JSON-схему в задании; следуй ей без отклонений;
- возвращай только JSON, без Markdown-обёртки и без лишних комментариев;
- все тексты — на русском, если пользователь не попросил другой язык.`

import type { CourseSettings } from "../content/types"
import { VOLUME_LIMITS, type ClarifyAnswer, type GenerateCourseInput, type Outline } from "./schema"

function formatAnswers(answers: ClarifyAnswer[]): string {
  if (answers.length === 0) return "Пользователь не стал уточнять — реши сам."
  return answers
    .filter((answer) => answer.answer.trim())
    .map((answer) => `- ${answer.question}: ${answer.answer}`)
    .join("\n")
}

function materialsBlock(materials?: string): string {
  const text = materials?.trim()
  return text ? `\n\nМатериалы пользователя:\n${text}\n` : ""
}

export function clarifyPrompt(topic: string, materials?: string): string {
  return `Пользователь хочет учиться по теме: "${topic}".
${materialsBlock(materials)}
Сформулируй 2–3 уточняющих вопроса, которые помогут собрать курс именно под него.
Если приложены материалы, опирайся на них: спроси о том, что в них важно, непонятно
или требует углубления. Не спрашивай про объём — приложение спросит отдельно.
Вопросы должны быть конкретными, с вариантами, а не общими пожеланиями.

Верни только JSON:
{"questions":[{"id":"goal","prompt":"...","type":"single|multiple","options":["...","..."]}]}

У каждого вопроса 2–6 вариантов. Тип single — можно выбрать один вариант,
multiple — несколько. Пиши по-русски.`
}

export interface OutlinePromptInput extends GenerateCourseInput {
  materialsText?: string
}

export function outlinePrompt(input: OutlinePromptInput): string {
  const limits = VOLUME_LIMITS[input.volume]
  return `Запрос ученика: "${input.topic}"
Уточнения:
${formatAnswers(input.answers)}
${materialsBlock(input.materialsText)}
Объём: ${input.volume} — от ${limits.min} до ${limits.max} уроков.

Собери карточку и структуру курса. Верни только JSON:
{
  "title": "...",
  "description": "...",
  "theme": "forest|amber|ocean|plum|clay",
  "icon": "book|code|chart|globe|atom|scale|palette|heart",
  "mode": "general|math|programming",
  "runtime": "none|lua|c|cpp|python|javascript|custom",
  "mentorPrompt": "...",
  "chapters": [{"title": "...", "description": "...", "lessons": ["...", "..."]}]
}

Требования:
- название — 2–6 слов, описание — 1–2 предложения;
- режим: general — гуманитарный разбор, math — формулы и шаги, programming — код;
- для general и math runtime "none"; для programming выбери язык;
- глав 1–4, в каждой 1–8 уроков; всего уроков — в указанном объёме;
- mentorPrompt — отдельные правила наставника этого курса: объяснять, задавать
  вопросы, проверять процесс, учитывать приложенные файлы и не давать готовых решений;
- используй приложенные материалы как источник фактов и примеров;
- никаких готовых решений и лишних полей.`
}

export interface LessonPromptInput {
  topic: string
  outline: Outline
  chapterTitle: string
  chapterDescription: string
  lessonTitle: string
  mode: "general" | "math" | "programming"
  settings: CourseSettings
  mentorPrompt: string
  index: number
  total: number
  materialsText?: string
}

export function lessonPrompt(input: LessonPromptInput): string {
  const { outline, chapterTitle, chapterDescription, lessonTitle, mode, settings, index, total } = input
  const quizShape = `"quiz": {
    "title": "...",
    "questions": [
      {"id":"q1","type":"single","prompt":"...","options":["...","..."],"correct":0,"explanation":"..."},
      {"id":"q2","type":"single","prompt":"...","options":["...","..."],"correct":0,"explanation":"..."},
      {"id":"q3","type":"text","prompt":"...","referenceAnswer":"...","criteria":["..."]},
      {"id":"q4","type":"text","prompt":"...","referenceAnswer":"...","criteria":["..."]}
    ]
  }`

  const practice =
    mode === "programming"
      ? `"tasks": [{
    "title": "...",
    "prompt": "...",
    "kind": "code",
    "entry": "${settings.entry}",
    "files": [{"name":"${settings.entry}","content":"стартовый код с TODO, без готового решения"}],
    "args": [],
    "stdin": "",
    "timeoutMs": 5000
  }]`
      : mode === "math"
        ? `"tasks": [{
    "title": "...",
    "prompt": "Задача, которую нужно решить по шагам.",
    "kind": "steps",
    "entry": "solution.json",
    "files": [{"name":"solution.json","content":"{\\"steps\\":[],\\"answer\\":\\"\\"}"}],
    "criteria": ["верный ход", "каждое преобразование объяснено", "верный финальный ответ"]
  }]`
        : `"tasks": []`

  return `Курс: "${outline.title}" — ${outline.description}
Режим: ${mode}. Среда: ${settings.runtime} (${settings.fileExtension}).
Наставник курса: ${input.mentorPrompt}
Тема ученика: ${input.topic}
${materialsBlock(input.materialsText)}
Глава: ${chapterTitle}${chapterDescription ? ` — ${chapterDescription}` : ""}
Урок ${index} из ${total}: ${lessonTitle}

Напиши урок. Верни только JSON:
{
  "title": "${lessonTitle}",
  "theoryMarkdown": "...",
  "practiceIntro": "...",
  ${quizShape},
  ${practice}
}

Требования:
- теория на русском, 500–900 слов, живая и конкретная, с примерами;
- не давай готовых ответов и полных решений;
- квиз строго 50/50: 2 тестовых вопроса (single, 3–4 варианта, correct и
  explanation) и 2 письменных (text, referenceAnswer и criteria);
- ${mode === "general" ? "практика — этот же квиз, tasks должен быть пустым" : mode === "math" ? "практика — одна задача kind=steps с шагами и финальным ответом" : "практика — одна код-задача kind=code с запуском"};
- используй приложенные материалы как источник фактов, примеров и формулировок;
- не выдумывай факты, которых нет в материалах и общей теме.`
}

