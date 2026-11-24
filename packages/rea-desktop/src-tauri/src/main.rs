// BoxREA Desktop App - Tauri v2 Backend

use tauri::{
    Manager, State, Emitter, Listener, WebviewUrl, WebviewWindowBuilder,
    menu::{Menu, MenuItem},
};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::process::Command;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Project {
    id: String,
    name: String,
    description: Option<String>,
    path: String,
    created_at: i64,
    updated_at: i64,
    targets: Vec<String>,
    settings: ProjectSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProjectSettings {
    default_provider: String,
    auto_analyze: bool,
    analysis_profile: String,
    evidence_retention_days: u32,
    max_concurrent_sessions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TargetInfo {
    id: String,
    path: String,
    name: String,
    target_type: String,
    size: u64,
    sha256: String,
    architecture: Option<String>,
    bits: Option<u32>,
    endianness: Option<String>,
    os: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnalysisRequest {
    target_path: String,
    provider: Option<String>,
    profile: Option<String>,
    include_decompilation: bool,
    include_callgraph: bool,
    max_functions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnalysisResponse {
    success: bool,
    session_id: Option<String>,
    target: Option<TargetInfo>,
    triage: Option<serde_json::Value>,
    decompilations: Option<Vec<serde_json::Value>>,
    callgraph: Option<serde_json::Value>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProviderInfo {
    id: String,
    name: String,
    enabled: bool,
    priority: i32,
    capabilities: Vec<String>,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EvidenceBundle {
    id: String,
    target: TargetInfo,
    created_at: i64,
    sessions: Vec<serde_json::Value>,
    analyses: serde_json::Value,
    notes: Vec<serde_json::Value>,
    bookmarks: Vec<serde_json::Value>,
    tags: Vec<String>,
}

// ============================================================================
// App State
// ============================================================================

struct AppState {
    projects: Mutex<HashMap<String, Project>>,
    current_project: Mutex<Option<String>>,
    rea_sidecar: Mutex<Option<tokio::process::Child>>,
    config: Mutex<AppConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppConfig {
    workspace_path: String,
    preferred_provider: String,
    ui_theme: String,
    ui_font_size: u32,
    show_addresses: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            workspace_path: dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("BoxREA")
                .to_string_lossy()
                .to_string(),
            preferred_provider: "auto".to_string(),
            ui_theme: "system".to_string(),
            ui_font_size: 13,
            show_addresses: true,
        }
    }
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
async fn greet(name: &str) -> Result<String, String> {
    Ok(format!("Hello, {}! Welcome to BoxREA.", name))
}

#[tauri::command]
async fn get_config(state: State<'_, Arc<AppState>>) -> Result<AppConfig, String> {
    Ok(state.config.lock().unwrap().clone())
}

#[tauri::command]
async fn update_config(state: State<'_, Arc<AppState>>, config: AppConfig) -> Result<(), String> {
    *state.config.lock().unwrap() = config;
    Ok(())
}

#[tauri::command]
async fn list_projects(state: State<'_, Arc<AppState>>) -> Result<Vec<Project>, String> {
    let projects = state.projects.lock().unwrap();
    Ok(projects.values().cloned().collect())
}

#[tauri::command]
async fn create_project(state: State<'_, Arc<AppState>>, name: String, description: Option<String>) -> Result<Project, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    
    let config = state.config.lock().unwrap().clone();
    let project_path = std::path::Path::new(&config.workspace_path).join("projects").join(&name.to_lowercase().replace(' ', "-"));
    
    std::fs::create_dir_all(&project_path).map_err(|e| e.to_string())?;
    
    let project = Project {
        id: id.clone(),
        name,
        description,
        path: project_path.to_string_lossy().to_string(),
        created_at: now,
        updated_at: now,
        targets: vec![],
        settings: ProjectSettings {
            default_provider: config.preferred_provider,
            auto_analyze: true,
            analysis_profile: "standard".to_string(),
            evidence_retention_days: 30,
            max_concurrent_sessions: 4,
        },
    };
    
    // Save project file
    let project_file = project_path.join("project.json");
    std::fs::write(&project_file, serde_json::to_string_pretty(&project).unwrap()).map_err(|e| e.to_string())?;
    
    state.projects.lock().unwrap().insert(id.clone(), project.clone());
    *state.current_project.lock().unwrap() = Some(id);
    
    Ok(project)
}

#[tauri::command]
async fn load_project(state: State<'_, Arc<AppState>>, project_id: String) -> Result<Project, String> {
    let projects = state.projects.lock().unwrap();
    let project = projects.get(&project_id).cloned()
        .ok_or("Project not found")?;
    
    *state.current_project.lock().unwrap() = Some(project_id);
    Ok(project)
}

#[tauri::command]
async fn delete_project(state: State<'_, Arc<AppState>>, project_id: String) -> Result<(), String> {
    let mut projects = state.projects.lock().unwrap();
    if let Some(project) = projects.remove(&project_id) {
        std::fs::remove_dir_all(&project.path).map_err(|e| e.to_string())?;
        if state.current_project.lock().unwrap().as_ref() == Some(&project_id) {
            *state.current_project.lock().unwrap() = None;
        }
        Ok(())
    } else {
        Err("Project not found".to_string())
    }
}

#[tauri::command]
async fn analyze_target(state: State<'_, Arc<AppState>>, request: AnalysisRequest) -> Result<AnalysisResponse, String> {
    // This would call the REA core via sidecar or IPC
    // For now, return a mock response
    Ok(AnalysisResponse {
        success: true,
        session_id: Some(uuid::Uuid::new_v4().to_string()),
        target: Some(TargetInfo {
            id: uuid::Uuid::new_v4().to_string(),
            path: request.target_path.clone(),
            name: std::path::Path::new(&request.target_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string(),
            target_type: "elf".to_string(),
            size: 0,
            sha256: "".to_string(),
            architecture: Some("x86_64".to_string()),
            bits: Some(64),
            endianness: Some("little".to_string()),
            os: Some("linux".to_string()),
        }),
        triage: Some(serde_json::json!({
            "summary": {
                "functions": 1234,
                "strings": 5678,
                "imports": 123,
                "exports": 45,
                "sections": 12,
                "entropy": 7.2,
                "architecture": "x86_64"
            }
        })),
        decompilations: None,
        callgraph: None,
        error: None,
    })
}

#[tauri::command]
async fn get_providers(state: State<'_, Arc<AppState>>) -> Result<Vec<ProviderInfo>, String> {
    Ok(vec![
        ProviderInfo {
            id: "ghidra".to_string(),
            name: "Ghidra Headless Analyzer".to_string(),
            enabled: true,
            priority: 1,
            capabilities: vec!["native-decompile", "native-callgraph", "native-strings"].into_iter().map(String::from).collect(),
            status: "available".to_string(),
        },
        ProviderInfo {
            id: "kuna".to_string(),
            name: "Kuna Whole-Program Analysis".to_string(),
            enabled: true,
            priority: 2,
            capabilities: vec!["native-decompile", "native-callgraph", "native-strings"].into_iter().map(String::from).collect(),
            status: "available".to_string(),
        },
        ProviderInfo {
            id: "ida".to_string(),
            name: "IDA Pro MCP".to_string(),
            enabled: false,
            priority: 3,
            capabilities: vec!["native-decompile", "native-callgraph"].into_iter().map(String::from).collect(),
            status: "unavailable".to_string(),
        },
        ProviderInfo {
            id: "rea-js".to_string(),
            name: "REA JavaScript Analyzer".to_string(),
            enabled: true,
            priority: 1,
            capabilities: vec!["js-decompile", "js-callgraph"].into_iter().map(String::from).collect(),
            status: "available".to_string(),
        },
    ])
}

#[tauri::command]
async fn open_file_dialog() -> Result<Option<String>, String> {
    // This would use tauri::dialog::FileDialogBuilder
    // For now, return None
    Ok(None)
}

#[tauri::command]
async fn save_file_dialog(default_name: String) -> Result<Option<String>, String> {
    Ok(None)
}

// ============================================================================
// Sidecar Management
// ============================================================================

async fn start_rea_sidecar(app: &tauri::AppHandle) -> Result<(), String> {
    // Start the REA core as a sidecar process
    // This would run the Node.js REA MCP client
    Ok(())
}

// ============================================================================
// Main
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .manage(Arc::new(AppState {
            projects: Mutex::new(HashMap::new()),
            current_project: Mutex::new(None),
            rea_sidecar: Mutex::new(None),
            config: Mutex::new(AppConfig::default()),
        }))
        .invoke_handler(tauri::generate_handler![
            greet,
            get_config,
            update_config,
            list_projects,
            create_project,
            load_project,
            delete_project,
            analyze_target,
            get_providers,
            open_file_dialog,
            save_file_dialog,
        ])
        .setup(|app| {
            // Initialize
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_rea_sidecar(&app_handle).await {
                    eprintln!("Failed to start REA sidecar: {}", e);
                }
            });
            
            // Load projects from workspace
            // ...
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}