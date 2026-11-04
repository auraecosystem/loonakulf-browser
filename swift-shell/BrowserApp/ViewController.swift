import UIKit
import WebKit

class ViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    var uiWebView: WKWebView!
    var targetWebView: WKWebView!

    private let maxBookmarkletBytes = 256 * 1024

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
            frame: CGRect(
                x: 0,
                y: 300,
                width: self.view.frame.width,
                height: self.view.frame.height - 300
            )
        )
        targetWebView.navigationDelegate = self
        targetWebView.load(URLRequest(url: URL(string: "https://example.com")!))
        self.view.addSubview(targetWebView)
    }

    private func isTrustedUiOrigin(_ origin: WKSecurityOrigin) -> Bool {
        return origin.protocol == "http" &&
            origin.host == "localhost" &&
            origin.port == 3000
    }

    private func isHttpUrl(_ url: URL?) -> Bool {
        guard let url = url,
              let scheme = url.scheme?.lowercased(),
              let host = url.host,
              !host.isEmpty else {
            return false
        }
        return scheme == "http" || scheme == "https"
    }

    private func originString(_ url: URL) -> String? {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        return components.string
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if webView === uiWebView {
            let trusted = url.scheme == "http" &&
                url.host == "localhost" &&
                url.port == 3000
            decisionHandler(trusted ? .allow : .cancel)
            return
        }

        decisionHandler(isHttpUrl(url) ? .allow : .cancel)
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "bookmarkletBridge",
              message.frameInfo.isMainFrame,
              isTrustedUiOrigin(message.frameInfo.securityOrigin),
              let request = message.body as? [String: Any],
              let title = request["title"] as? String,
              !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              title.count <= 120,
              let source = request["source"] as? String,
              !source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              source.utf8.count <= maxBookmarkletBytes,
              !source.unicodeScalars.contains(where: { $0.value < 32 && $0.value != 9 && $0.value != 10 && $0.value != 13 }),
              let targetUrl = targetWebView.url,
              isHttpUrl(targetUrl),
              let targetOrigin = originString(targetUrl) else {
            return
        }

        let alert = UIAlertController(
            title: "Run bookmarklet?",
            message: "Run \"" + title + "\" on " + targetOrigin + "? This script runs with the active page's privileges. It may read or modify page content and access data available to scripts on this origin. Continue only if you trust the source.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Run once", style: .destructive) { [weak self] _ in
            guard let self = self,
                  let currentUrl = self.targetWebView.url,
                  self.isHttpUrl(currentUrl),
                  self.originString(currentUrl) == targetOrigin else {
                return
            }

            var cleanSource = source.trimmingCharacters(in: .whitespacesAndNewlines)
            if cleanSource.lowercased().hasPrefix("javascript:") {
                cleanSource = String(cleanSource.dropFirst("javascript:".count))
                    .trimmingCharacters(in: .whitespacesAndNewlines)
            }
            guard !cleanSource.isEmpty else { return }

            self.targetWebView.evaluateJavaScript(cleanSource) { _, error in
                if let error = error {
                    print("Bookmarklet execution failed: " + error.localizedDescription)
                }
            }
        })
        present(alert, animated: true)
    }

    deinit {
        uiWebView?.configuration.userContentController
            .removeScriptMessageHandler(forName: "bookmarkletBridge")
    }
}
