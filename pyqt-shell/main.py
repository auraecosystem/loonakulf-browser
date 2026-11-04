import sys
from PyQt5.QtCore import QUrl, pyqtSlot, QObject
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineProfile
from PyQt5.QtWebChannel import QWebChannel

class PyQtBridge(QObject):
    def __init__(self, target_browser):
        super().__init__()
        self.target_browser = target_browser

    @pyqtSlot(str)
    def execute(self, raw_code):
        clean_code = raw_code.replace("javascript:", "")
        self.target_browser.page().runJavaScript(clean_code)

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
        self.bridge = PyQtBridge(self.target_browser)
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
    app.setApplicationName("Loonakulf Browser")

    profile = QWebEngineProfile.defaultProfile()
    default_user_agent = profile.httpUserAgent().strip()
    if "Loonakulf/" not in default_user_agent:
        profile.setHttpUserAgent(default_user_agent + " Loonakulf/1.0.0")
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())
