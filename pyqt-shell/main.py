import sys
import re
from urllib.parse import unquote
from PyQt5.QtCore import QUrl, pyqtSlot, QObject
from PyQt5.QtWidgets import QApplication, QMainWindow, QMessageBox, QVBoxLayout, QWidget
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWebChannel import QWebChannel

class PyQtBridge(QObject):
    MAX_BOOKMARKLET_LENGTH = 256 * 1024

    def __init__(self, target_browser, parent=None):
        super().__init__(parent)
        self.target_browser = target_browser

    @pyqtSlot(str)
    def execute(self, raw_code):
        if not isinstance(raw_code, str) or not raw_code or len(raw_code) > self.MAX_BOOKMARKLET_LENGTH:
            return

        clean_code = raw_code.strip()
        clean_code = re.sub(r"^javascript:", "", clean_code, count=1, flags=re.IGNORECASE).strip()
        if not clean_code or "\\x00" in clean_code:
            return
        if re.search(r"%[0-9a-fA-F]{2}", clean_code):
            try:
                clean_code = unquote(clean_code, errors="strict")
            except (UnicodeDecodeError, ValueError):
                return

        page_url = self.target_browser.url().toString()
        answer = QMessageBox.question(
            self.parent(),
            "Run bookmarklet?",
            f"This script will execute in the active page:\\n{page_url}\\n\\n"
            "Bookmarklets can read and modify page content and use the page's privileges. Continue?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if answer != QMessageBox.Yes:
            return

        self.target_browser.page().runJavaScript(clean_code)

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PyQt Backup Container Engine")
        self.resize(1300, 850)

        self.ui_browser = QWebEngineView()
        self.ui_browser.setUrl(QUrl("http://localhost:3000"))

        self.target_browser = QWebEngineView()
        self.target_browser.setUrl(QUrl("https://example.com"))

        self.channel = QWebChannel()
        self.bridge = PyQtBridge(self.target_browser, self)
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
