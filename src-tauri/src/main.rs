#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

struct ServerProcess(Mutex<Option<Child>>);

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
    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    parts.join(separator)
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

fn default_project_root(app: &AppHandle) -> PathBuf {
    let base = app
        .path()
        .document_dir()
        .ok()
        .or_else(|| app.path().home_dir().ok())
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("Лестница обучения")
}

fn spawn_server(app: &AppHandle) -> std::io::Result<Child> {
    let resources = app.path().resource_dir().map_err(|error| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("resource_dir: {error}"),
        )
    })?;
    let node_name = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };
    let node = resources.join("node").join(node_name);
    let server = resources.join("server").join("server.cjs");
    let web = resources.join("web");

    for (label, path) in [
        ("Node", node.as_path()),
        ("server", server.as_path()),
        ("web", web.as_path()),
    ] {
        if !path.exists() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("{label} не найден: {}", path.display()),
            ));
        }
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(&node) {
            let mut permissions = metadata.permissions();
            let mode = permissions.mode();
            if mode & 0o111 == 0 {
                permissions.set_mode(mode | 0o755);
                let _ = std::fs::set_permissions(&node, permissions);
            }
        }
    }

    let project = default_project_root(app);
    std::fs::create_dir_all(project.join("data"))?;

    let mut command = Command::new(&node);
    command
        .arg(&server)
        .current_dir(&project)
        .env("NODE_ENV", "production")
        .env("PORT", "4173")
        .env("PATH", search_path())
        .env("LEARNINGLUA_DESKTOP", "1")
        .env("LEARNINGLUA_STATIC_ROOT", &web)
        .env("LEARNINGLUA_PROJECT_ROOT", &project)
        .stdin(Stdio::null());

    let log_path = project.join("data").join("tauri-server.log");
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

fn ensure_server(app: &AppHandle, slot: &Mutex<Option<Child>>) -> bool {
    if server_healthy() {
        return true;
    }
    let child = match spawn_server(app) {
        Ok(child) => child,
        Err(error) => {
            eprintln!("Лестница обучения: не удалось запустить сервер: {error}");
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
        "Лестница обучения: сервер не ответил за 45 секунд. Смотрите data/tauri-server.log в папке проекта"
    );
    false
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(move |app| {
            let url = if cfg!(debug_assertions) {
                "http://localhost:5173".to_string()
            } else {
                let state = app.state::<ServerProcess>();
                ensure_server(app.handle(), &state.0);
                "http://127.0.0.1:4173".to_string()
            };

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse().unwrap()))
                .title("Лестница обучения")
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .position(80.0, 60.0)
                .build()?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("ошибка сборки приложения «Лестница обучения»")
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
