use tauri::{LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};

// Called from Vue via invoke('open_tab_url', { url })
#[tauri::command]
fn open_tab_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    
    // Create or navigate a child webview below the 80px Vue toolbar
    let webview_builder = WebviewBuilder::new("content-view", WebviewUrl::External(url.parse().unwrap()));
    window.add_child(
        webview_builder,
        LogicalPosition::new(0.0, 80.0),
        LogicalSize::new(1200.0, 720.0),
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

