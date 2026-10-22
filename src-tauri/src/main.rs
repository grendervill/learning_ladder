#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

struct ServerProcess(Mutex<Option<Child>>);

fn project_root() -> PathBuf {
    if let Ok(root) = std::env::var("LEARNINGLUA_ROOT") {
        let path = PathBuf::from(root);
        if path.join("server").join("index.ts").exists() {
            return path;
        }
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| manifest.clone())
}

fn find_executable(name: &str) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = vec![
        PathBuf::from("/opt/homebrew/bin").join(name),
        PathBuf::from("/usr/local/bin").join(name),
        PathBuf::from("/usr/bin").join(name),
        PathBuf::from("/bin").join(name),
    ];
    if let Ok(home) = std::env::var("HOME") {
        candidates.insert(0, PathBuf::from(&home).join(".local/bin").join(name));
        candidates.insert(0, PathBuf::from(&home).join(".nvm/current/bin").join(name));
    }
    candidates.into_iter().find(|path| path.exists())
}

fn search_path() -> String {
    let mut parts: Vec<String> = vec![
        "/opt/homebrew/bin".into(),
        "/opt/homebrew/sbin".into(),
        "/usr/local/bin".into(),
        "/usr/bin".into(),
        "/bin".into(),
        "/usr/sbin".into(),
        "/sbin".into(),
    ];
    if let Ok(home) = std::env::var("HOME") {
        parts.insert(0, format!("{home}/.local/bin"));
    }
    if let Ok(existing) = std::env::var("PATH") {
        parts.push(existing);
    }
    parts.join(":")
}

fn server_healthy() -> bool {
    let Ok(mut stream) = TcpStream::connect_timeout(
        &"127.0.0.1:4173".parse().expect("valid socket address"),
        Duration::from_millis(400),
    ) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(900)));
    let _ = stream.write_all(
        b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
    );
    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    response.contains("\"status\":\"ok\"")
}

fn spawn_server(root: &Path) -> std::io::Result<Child> {
    let node = find_executable("node").unwrap_or_else(|| PathBuf::from("node"));
    let mut command = Command::new(node);
    command
        .arg("--import")
        .arg("tsx")
        .arg("server/index.ts")
        .current_dir(root)
        .env("NODE_ENV", "production")
        .env("PORT", "4173")
        .env("PATH", search_path())
        .env("LEARNINGLUA_DESKTOP", "1")
        .stdin(Stdio::null());

    let log_path = root.join("data").join("tauri-server.log");
    if let Some(log_dir) = log_path.parent() {
        let _ = std::fs::create_dir_all(log_dir);
    }
    match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(file) => {
            if let Ok(errors) = file.try_clone() {
                command.stdout(Stdio::from(file)).stderr(Stdio::from(errors));
            } else {
                command.stdout(Stdio::from(file)).stderr(Stdio::null());
            }
        }
        Err(_) => {
            command.stdout(Stdio::null()).stderr(Stdio::null());
        }
    }

    command.spawn()
}

fn ensure_server(root: &Path, slot: &Mutex<Option<Child>>) -> bool {
    if server_healthy() {
        return true;
    }
    let child = match spawn_server(root) {
        Ok(child) => child,
        Err(error) => {
            eprintln!("LearningLua: не удалось запустить сервер: {error}");
            return false;
        }
    };
    if let Ok(mut guard) = slot.lock() {
        *guard = Some(child);
    }
    let deadline = Instant::now() + Duration::from_secs(45);
    while Instant::now() < deadline {
        if server_healthy() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    eprintln!(
        "LearningLua: сервер не ответил за 45 секунд. Смотрите data/tauri-server.log"
    );
    false
}

fn main() {
    let root = project_root();

    tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .setup(move |app| {
            let url = if cfg!(debug_assertions) {
                "http://localhost:5173".to_string()
            } else {
                let state = app.state::<ServerProcess>();
                ensure_server(&root, &state.0);
                "http://127.0.0.1:4173".to_string()
            };

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse().unwrap()))
                .title("Лестница Lua")
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .center()
                .build()?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("ошибка сборки приложения LearningLua")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                let state = app_handle.state::<ServerProcess>();
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                };
            }
        });
}
