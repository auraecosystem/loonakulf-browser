import UIKit
import WebKit

class ViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    var uiWebView: WKWebView!
    var targetWebView: WKWebView!

    private func isTrustedUiOrigin(_ origin: WKSecurityOrigin) -> Bool {
        return origin.protocol == "http" &&
            origin.host == "localhost" &&
            origin.port == 3000
    }

    private func isTrustedUiUrl(_ url: URL?) -> Bool {
        guard let url = url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return false
        }
        return components.scheme == "http" &&
            components.host == "localhost" &&
            components.port == 3000 &&
            components.user == nil &&
            components.password == nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebViews()
    }

    func setupWebViews() {
        let contentController = WKUserContentController()
        contentController.add(self, name: "bookmarkletBridge")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        uiWebView = WKWebView(
            frame: CGRect(x: 0, y: 0, width: self.view.frame.width, height: 300),
            configuration: config
        )
        uiWebView.navigationDelegate = self
        uiWebView.load(URLRequest(url: URL(string: "http://localhost:3000")!))
        self.view.addSubview(uiWebView)

        targetWebView = WKWebView(
            frame: CGRect(x: 0, y: 300, width: self.view.frame.width, height: self.view.frame.height - 300)
        )
        targetWebView.load(URLRequest(url: URL(string: "https://example.com")!))
        self.view.addSubview(targetWebView)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard webView === uiWebView else {
            decisionHandler(.allow)
            return
        }
        decisionHandler(isTrustedUiUrl(navigationAction.request.url) ? .allow : .cancel)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        guard webView === uiWebView else {
            decisionHandler(.allow)
            return
        }
        decisionHandler(isTrustedUiUrl(navigationResponse.response.url) ? .allow : .cancel)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "bookmarkletBridge",
              message.frameInfo.isMainFrame,
              isTrustedUiOrigin(message.frameInfo.securityOrigin),
              let rawCode = message.body as? String,
              !rawCode.isEmpty,
              rawCode.utf8.count <= 256 * 1024 else {
            return
        }

        var cleanCode = rawCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleanCode.range(of: "^javascript:", options: [.regularExpression, .caseInsensitive]) != nil {
            cleanCode = String(cleanCode.dropFirst("javascript:".count))
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard !cleanCode.isEmpty, !cleanCode.contains("\0"),
              let targetUrl = targetWebView.url else {
            return
        }

        let origin = URLComponents(url: targetUrl, resolvingAgainstBaseURL: false)
        let targetLabel = origin?.host ?? "the active page"
        let alert = UIAlertController(
            title: "Run bookmarklet?",
            message: "This script will execute on \(targetLabel). Bookmarklets can read and modify page content and use the page's privileges. Continue?",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Run", style: .destructive) { [weak self] _ in
            guard let self = self, self.targetWebView.url == targetUrl else { return }
            self.targetWebView.evaluateJavaScript(cleanCode) { (_, error) in
                if let error = error {
                    print("Mobile script engine error: \(error.localizedDescription)")
                }
            }
        })
        present(alert, animated: true)
    }
}
