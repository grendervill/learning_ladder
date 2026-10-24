export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  goal TEXT,
  summary_md TEXT,
  stats_json TEXT,
  mentor_session_id TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  lesson_id TEXT,
  task_id TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_session ON activity_events(session_id, created_at);

CREATE TABLE IF NOT EXISTS lesson_progress (
  lesson_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'locked',
  best_grade INTEGER,
  last_grade INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  feedback_json TEXT,
  unlocked_at TEXT,
  passed_at TEXT,
  imported_from TEXT
);

CREATE TABLE IF NOT EXISTS chapter_progress (
  chapter_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'locked',
  chapter_quiz_grade INTEGER,
  best_grade INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  feedback_json TEXT,
  unlocked_at TEXT,
  passed_at TEXT
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, scope_id, question_id)
);

CREATE TABLE IF NOT EXISTS task_files (
  lesson_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (lesson_id, task_id, file_name)
);

CREATE TABLE IF NOT EXISTS task_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  stdout TEXT,
  stderr TEXT,
  exit_code INTEGER,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(lesson_id, task_id, created_at);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  code_json TEXT,
  runs_json TEXT,
  quiz_json TEXT,
  grade INTEGER,
  feedback_json TEXT,
  mentor_session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_attempts_scope ON attempts(scope, scope_id, submitted_at);

CREATE TABLE IF NOT EXISTS mentor_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content_md TEXT NOT NULL,
  attachments_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_session ON mentor_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS content_versions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL,
  scanned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS terminal_state (
  lesson_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  cwd TEXT NOT NULL,
  PRIMARY KEY (lesson_id, task_id)
);

CREATE TABLE IF NOT EXISTS terminal_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  command TEXT NOT NULL,
  stdout TEXT,
  stderr TEXT,
  exit_code INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_terminal_commands_task ON terminal_commands(lesson_id, task_id, created_at);
`
