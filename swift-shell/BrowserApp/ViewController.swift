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

    // Capture execution messages coming straight from React buttons
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "bookmarkletBridge", let rawCode = message.body as? String {
            // Clean protocol wrapper strings
            let cleanCode = rawCode.replacingOccurrences(of: "javascript:", with: "").removingPercentEncoding ?? ""
            
            // Fire target code directly against current site contents
            targetWebView.evaluateJavaScript(cleanCode) { (result, error) in
                if let err = error {
                    print("Mobile script engine error: \(err.localizedDescription)")
                }
            }
        }
    }
}
