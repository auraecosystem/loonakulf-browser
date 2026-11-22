use tauri::{LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl, WindowEvent};

const CHROME_HEIGHT: f64 = 148.0;

#[tauri::command]
fn navigate_tab(app: tauri::AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;

    // Hide all other tab webviews first
    for (label, webview) in app.webviews() {
        if label.starts_with("tab-") && label != tab_id {
            let _ = webview.hide();
        }
    }

    // If this tab is set to about:blank, close any existing webview for it so the Vue New Tab page shows
    if url == "about:blank" {
        if let Some(existing) = app.get_webview(&tab_id) {
            let _ = existing.close();
        }
        return Ok(());
    }

    // Close existing webview for this tab_id before loading the new URL
    if let Some(existing) = app.get_webview(&tab_id) {
        let _ = existing.close();
    }

    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let physical_size = window.inner_size().map_err(|e| e.to_string())?;
    let width = physical_size.width as f64 / scale_factor;
    let height = (physical_size.height as f64 / scale_factor) - CHROME_HEIGHT;

    let webview_builder = WebviewBuilder::new(
        &tab_id,
        WebviewUrl::External(url.parse().map_err(|_| "Invalid URL")?)
    );

    window.add_child(
        webview_builder,
        LogicalPosition::new(0.0, CHROME_HEIGHT),
        LogicalSize::new(width, height.max(0.0)),
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn switch_tab(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
    for (label, webview) in app.webviews() {
        if label.starts_with("tab-") {
            if label == tab_id {
                let _ = webview.show();
            } else {
                let _ = webview.hide();
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn close_tab(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&tab_id) {
        let _ = webview.close();
    }
    Ok(())
}

#[tauri::command]
fn run_bookmarklet(app: tauri::AppHandle, tab_id: String, code: String) -> Result<(), String> {
    let content_webview = app
        .get_webview(&tab_id)
        .ok_or("Open a webpage in this tab before running a bookmarklet")?;

    content_webview.eval(&code).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            navigate_tab,
            switch_tab,
            close_tab,
            run_bookmarklet
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::Resized(physical_size) = event {
                let scale_factor = window.scale_factor().unwrap_or(1.0);
                let width = physical_size.width as f64 / scale_factor;
                let height = (physical_size.height as f64 / scale_factor) - CHROME_HEIGHT;

                // Resize all active tab webviews when window changes size
                for (label, webview) in window.app_handle().webviews() {
                    if label.starts_with("tab-") {
                        let _ = webview.set_size(LogicalSize::new(width, height.max(0.0)));
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
use serde::Serialize;
use tauri::{
    webview::PageLoadEvent, Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder,
    WebviewUrl, WindowEvent,
};

const CHROME_HEIGHT: f64 = 148.0;

#[derive(Clone, Serialize)]
struct TabUrlPayload {
    tab_id: String,
    url: String,
}

#[derive(Clone, Serialize)]
struct TabTitlePayload {
    tab_id: String,
    title: String,
}

#[tauri::command]
fn navigate_tab(app: tauri::AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;

    for (label, webview) in app.webviews() {
        if label.starts_with("tab-") && label != tab_id {
            let _ = webview.hide();
        }
    }

    if url == "about:blank" {
        if let Some(existing) = app.get_webview(&tab_id) {
            let _ = existing.close();
        }
        return Ok(());
    }

    if let Some(existing) = app.get_webview(&tab_id) {
        let _ = existing.close();
    }

    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let physical_size = window.inner_size().map_err(|e| e.to_string())?;
    let width = physical_size.width as f64 / scale_factor;
    let height = (physical_size.height as f64 / scale_factor) - CHROME_HEIGHT;

    // Clones for event closures
    let app_for_nav = app.clone();
    let tab_id_for_nav = tab_id.clone();

    let app_for_load = app.clone();
    let tab_id_for_load = tab_id.clone();

    let webview_builder = WebviewBuilder::new(
        &tab_id,
        WebviewUrl::External(url.parse().map_err(|_| "Invalid URL")?),
    )
    // 1. Sync address bar whenever user clicks a link inside the webpage
    .on_navigation(move |nav_url| {
        let _ = app_for_nav.emit(
            "tab-url-changed",
            TabUrlPayload {
                tab_id: tab_id_for_nav.clone(),
                url: nav_url.to_string(),
            },
        );
        true // Allow navigation
    })
    // 2. Sync tab title once the page finishes loading
    .on_page_load(move |webview, payload| {
        if let PageLoadEvent::Finished = payload.event() {
            // Ask the webpage for its document.title and send it back via a tiny script or title API
            let js = format!(
                "window.__TAURI_INTERNALS__?.invoke('update_tab_title', {{ tabId: '{}', title: document.title }})",
                tab_id_for_load
            );
            let _ = webview.eval(&js);
        }
    });

    window
        .add_child(
            webview_builder,
            LogicalPosition::new(0.0, CHROME_HEIGHT),
            LogicalSize::new(width, height.max(0.0)),
        )
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Receives document.title from the loaded webpage and forwards it to Vue
#[tauri::command]
fn update_tab_title(app: tauri::AppHandle, tab_id: String, title: String) {
    if !title.trim().is_empty() {
        let _ = app.emit("tab-title-changed", TabTitlePayload { tab_id, title });
    }
}
