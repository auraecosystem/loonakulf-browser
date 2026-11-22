import sys
import re

from PyQt5.QtCore import QUrl, pyqtSlot, QObject
from PyQt5.QtWidgets import QApplication, QMainWindow, QMessageBox, QVBoxLayout, QWidget
from PyQt5.QtWebEngineWidgets import QWebEnginePage, QWebEngineView
from PyQt5.QtWebChannel import QWebChannel


TRUSTED_UI_SCHEME = "http"
TRUSTED_UI_HOST = "localhost"
TRUSTED_UI_PORT = 3000


def is_trusted_ui_url(url):
    return (
        url.scheme().lower() == TRUSTED_UI_SCHEME
        and url.host().lower() == TRUSTED_UI_HOST
        and url.port(-1) == TRUSTED_UI_PORT
        and not url.userName()
        and not url.password()
    )


class TrustedUiPage(QWebEnginePage):
    def acceptNavigationRequest(self, url, navigation_type, is_main_frame):
        if not is_trusted_ui_url(url):
            return False
        return super().acceptNavigationRequest(url, navigation_type, is_main_frame)


class PyQtBridge(QObject):
    MAX_BOOKMARKLET_LENGTH = 256 * 1024

    def __init__(self, ui_browser, target_browser, parent=None):
        super().__init__(parent)
        self.ui_browser = ui_browser
        self.target_browser = target_browser

    @pyqtSlot(str)
    def execute(self, raw_code):
        if not is_trusted_ui_url(self.ui_browser.url()):
            return
        if not isinstance(raw_code, str) or not raw_code or len(raw_code) > self.MAX_BOOKMARKLET_LENGTH:
            return

        clean_code = raw_code.strip()
        clean_code = re.sub(r"^javascript:", "", clean_code, count=1, flags=re.IGNORECASE).strip()
        if not clean_code or "\x00" in clean_code:
            return

        target_url = self.target_browser.url()
        page_url = target_url.toString()
        answer = QMessageBox.question(
            self.parent(),
            "Run bookmarklet?",
            f"This script will execute in the active page:\n{page_url}\n\n"
            "Bookmarklets can read and modify page content and use the page's privileges. Continue?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if answer != QMessageBox.Yes or self.target_browser.url() != target_url:
            return

        self.target_browser.page().runJavaScript(clean_code)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PyQt Backup Container Engine")
        self.resize(1300, 850)

        self.ui_browser = QWebEngineView()
        self.ui_browser.setPage(TrustedUiPage(self.ui_browser))
        self.ui_browser.setUrl(QUrl("http://localhost:3000"))

        self.target_browser = QWebEngineView()
        self.target_browser.setUrl(QUrl("https://example.com"))

        self.channel = QWebChannel()
        self.bridge = PyQtBridge(self.ui_browser, self.target_browser, self)
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
