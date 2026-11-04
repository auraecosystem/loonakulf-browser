import json
import sys

from PyQt5.QtCore import QUrl, pyqtSlot, QObject
from PyQt5.QtWidgets import (
    QApplication,
    QMainWindow,
    QVBoxLayout,
    QWidget,
    QMessageBox,
)
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWebChannel import QWebChannel

MAX_BOOKMARKLET_BYTES = 256 * 1024
TRUSTED_UI_HOST = "localhost"
TRUSTED_UI_PORT = 3000


def is_trusted_ui_url(url):
    return (
        url.scheme() == "http"
        and url.host() == TRUSTED_UI_HOST
        and url.port() == TRUSTED_UI_PORT
    )


def is_http_target_url(url):
    return url.isValid() and url.scheme() in ("http", "https") and bool(url.host())


class PyQtBridge(QObject):
    def __init__(self, target_browser, ui_browser, parent=None):
        super().__init__(parent)
        self.target_browser = target_browser
        self.ui_browser = ui_browser

    @pyqtSlot(str)
    def execute(self, serialized_request):
        # QWebChannel is reachable from page JavaScript; validate the caller URL
        # and the full request again in native code before showing consent.
        if not is_trusted_ui_url(self.ui_browser.url()):
            return

        try:
            request = json.loads(serialized_request)
        except (TypeError, ValueError):
            return
        if not isinstance(request, dict):
            return

        title = request.get("title")
        source = request.get("source")
        if (
            not isinstance(title, str)
            or not title.strip()
            or len(title) > 120
            or not isinstance(source, str)
            or not source.strip()
            or len(source.encode("utf-8")) > MAX_BOOKMARKLET_BYTES
            or any(ord(char) < 32 and char not in "\t\n\r" for char in source)
        ):
            return

        target_url = self.target_browser.url()
        if not is_http_target_url(target_url):
            return
        target_origin = target_url.toString(QUrl.RemovePath | QUrl.RemoveQuery | QUrl.RemoveFragment)

        answer = QMessageBox.question(
            self.target_browser,
            "Run bookmarklet?",
            (
                "Run \"" + title.strip() + "\" on " + target_origin + "?\n\n"
                "This script runs with the active page's privileges. It may read "
                "or modify page content and access data available to scripts on "
                "this origin. Continue only if you trust the source.\\n\\nSource preview:\\n"
                + source[:600]
                + ("…" if len(source) > 600 else "")
            ),
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if answer != QMessageBox.Yes:
            return

        current_url = self.target_browser.url()
        if (
            not is_http_target_url(current_url)
            or current_url.scheme() != target_url.scheme()
            or current_url.host() != target_url.host()
            or current_url.port() != target_url.port()
        ):
            return

        # Source is already normalized by the shared UI. Never repeatedly decode it.
        clean_source = source.strip()
        if clean_source.lower().startswith("javascript:"):
            clean_source = clean_source[len("javascript:"):].strip()
        if not clean_source:
            return

        self.target_browser.page().runJavaScript(clean_source)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Loonakulf Browser")
        self.resize(1300, 850)

        self.ui_browser = QWebEngineView()
        self.ui_browser.setUrl(QUrl("http://localhost:3000"))

        self.target_browser = QWebEngineView()
        self.target_browser.setUrl(QUrl("https://example.com"))

        self.channel = QWebChannel()
        self.bridge = PyQtBridge(self.target_browser, self.ui_browser, self)
        self.channel.registerObject("pyqtBridge", self.bridge)
        self.ui_browser.page().setWebChannel(self.channel)

        layout = QVBoxLayout()
        layout.addWidget(self.ui_browser, stretch=1)
        layout.addWidget(self.target_browser, stretch=1)

        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())
