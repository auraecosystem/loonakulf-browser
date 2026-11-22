import UIKit
import WebKit

class ViewController: UIViewController, WKScriptMessageHandler {
    var uiWebView: WKWebView!
    var targetWebView: WKWebView! // The site being manipulated

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebViews()
    }

    func setupWebViews() {
        // Link the specific script listener keyword assigned in React
        let contentController = WKUserContentController()
        contentController.add(self, name: "bookmarkletBridge")
        
        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        
        // 1. Initialize your UI container
        uiWebView = WKWebView(frame: CGRect(x: 0, y: 0, width: self.view.frame.width, height: 300), configuration: config)
        uiWebView.load(URLRequest(url: URL(string: "http://localhost:3000")!))
        self.view.addSubview(uiWebView)
        
        // 2. Initialize the site tab browser underneath it
        targetWebView = WKWebView(frame: CGRect(x: 0, y: 300, width: self.view.frame.width, height: self.view.frame.height - 300))
        targetWebView.load(URLRequest(url: URL(string: "https://example.com")!))
        self.view.addSubview(targetWebView)
    }

    // Native confirmation is required even when the shared UI has already prompted.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "bookmarkletBridge",
              let rawCode = message.body as? String,
              !rawCode.isEmpty,
              rawCode.utf8.count <= 256 * 1024 else {
            return
        }

        var cleanCode = rawCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleanCode.range(of: "^javascript:", options: [.regularExpression, .caseInsensitive]) != nil {
            cleanCode = String(cleanCode.dropFirst("javascript:".count)).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard !cleanCode.isEmpty, !cleanCode.contains("\0") else { return }
        let origin = targetWebView.url?.host ?? "the active page"
        let alert = UIAlertController(
            title: "Run bookmarklet?",
            message: "This script will execute on \(origin). Bookmarklets can read and modify page content and use the page's privileges. Continue?",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Run", style: .destructive) { [weak self] _ in
            guard let self = self, self.targetWebView.url?.host == origin else { return }
            self.targetWebView.evaluateJavaScript(cleanCode) { (_, error) in
                if let error = error {
                    print("Mobile script engine error: \(error.localizedDescription)")
                }
            }
        })
        present(alert, animated: true)
    }
}
