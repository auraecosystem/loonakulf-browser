export function processAndValidateBookmarklet(inputCode) {
  let code = inputCode ? inputCode.trim() : "";
  if (!code) return { isValid: false, error: "Code field cannot be empty.", cleanCode: "" };

  if (code.toLowerCase().startsWith("javascript:")) {
    code = code.substring(11).trim();
  }

  try {
    let decoded = code;
    while (decoded !== decodeURIComponent(decoded)) {
      decoded = decodeURIComponent(decoded);
    }
    code = decoded;
  } catch (e) {
    return { isValid: false, error: "Failed to decode URL characters safely.", cleanCode: "" };
  }

  code = code.replace(/\/\*[\s\S]*?\*\//g, "");
  let lines = code.split(/\r?\n/).map(line => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith("//")) return "";
    return cleanLine;
  });
  
  code = lines.filter(line => line.length > 0).join(" ");

  try {
    new Function(code);
  } catch (syntaxError) {
    return { isValid: false, error: `Syntax Verification Failed: ${syntaxError.message}`, cleanCode: "" };
  }

  if (!code.startsWith("(function") && !code.startsWith("javascript:(function")) {
    code = `(function(){${code}})();`;
  }

  return { isValid: true, error: null, cleanCode: `javascript:${code}` };
}

export function auditScriptSecurityRisks(cleanCode) {
  const securityWarnings = [];
  const lowercaseCode = cleanCode.toLowerCase();

  if (lowercaseCode.includes("document.cookie")) {
    securityWarnings.push("⚠️ Reading Session Cookies: This script accesses document.cookie, which may expose login tokens.");
  }
  if (lowercaseCode.includes("fetch(") || lowercaseCode.includes("xmlhttprequest") || lowercaseCode.includes("$.ajax")) {
    if (lowercaseCode.includes(".php") || lowercaseCode.includes("api/") || lowercaseCode.includes("http")) {
      securityWarnings.push("🌐 Cross-Domain Data Transmission: This script transmits data packets to an external network endpoint.");
    }
  }
  if (lowercaseCode.includes("input[type=\"password\"]") || lowercaseCode.includes("type='password'")) {
    securityWarnings.push("🔒 Password Input Inspection: This script explicitly searches for security credential input elements.");
  }

  return { isHighRisk: securityWarnings.length > 0, warnings: securityWarnings };
}
