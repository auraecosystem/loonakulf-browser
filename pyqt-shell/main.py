import sys
from PyQt5.QtCore import QUrl, pyqtSlot, QObject
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineProfile
from PyQt5.QtWebChannel import QWebChannel

class Bridge(QObject):
    def __init__(self, target_page):
        super().__init__()
        self.target_page = target_page

    @pyqtSlot(str)
    def execute(self, raw_code):
        # Format string and clear browser protocol flags
        clean_code = raw_code.replace("javascript:", "")
        # Run straight against the underlying Qt engine session
        self.target_page.runJavaScript(clean_code)

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PyQt Bookmarklet Browser")
        self.resize(1200, 800)

        # Web view for your React UI panel
        self.ui_browser = QWebEngineView()
        self.ui_browser.setUrl(QUrl("http://localhost:3000"))

        # Web view mimicking the target web site being modified
        self.target_browser = QWebEngineView()
        self.target_browser.setUrl(QUrl("https://example.com"))

        # Open communication bridges
        self.channel = QWebChannel()
        self.bridge = Bridge(self.target_browser.page())
        self.channel.registerObject("pyqtBridge", self.bridge)
        self.ui_browser.page().setWebChannel(self.channel)

        layout = QVBoxLayout()
        layout.addWidget(self.ui_browser, stretch=1)
        layout.addWidget(self.target_browser, stretch=2)

        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())
