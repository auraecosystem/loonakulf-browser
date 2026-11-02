/**
 * Safely parses, cleans, and optimizes user-submitted JavaScript into a production-ready bookmarklet.
 * @param {string} inputCode - The raw code pasted by the user.
 * @returns {Object} Result object containing validation status, errors, and clean code.
 */
export function processAndValidateBookmarklet(inputCode) {
  let code = inputCode ? inputCode.trim() : "";
  
  if (!code) {
    return { isValid: false, error: "Code field cannot be empty.", cleanCode: "" };
  }

  // 1. Strip the "javascript:" protocol prefix if it exists to clean the core runtime
  if (code.toLowerCase().startsWith("javascript:")) {
    code = code.substring(11).trim();
  }

  // 2. Handle URL-decoded components. If code was copied from a browser address bar, 
  // it might contain strings like %20 or %22. Let's return it to clean readable text first.
  try {
    // Decode until the string stabilizes (handles cases where text was double-encoded)
    let decoded = code;
    while (decoded !== decodeURIComponent(decoded)) {
      decoded = decodeURIComponent(decoded);
    }
    code = decoded;
  } catch (e) {
    return { isValid: false, error: "Failed to decode URL characters safely.", cleanCode: "" };
  }

  // 3. Basic Code Sanitization & Formatting (Flattening)
  // Remove multi-line block comments (/* ... */)
  code = code.replace(/\/\*[\s\S]*?\*\//g, "");
  
  // Remove single-line comments (// ... ) carefully, ensuring we don't break URL strings
  // Splitting by lines allows us to safely drop commented rows
  let lines = code.split(/\r?\n/);
  lines = lines.map(line => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith("//")) return ""; // Drop complete comment lines
    return cleanLine;
  });
  
  // Combine rows into a unified single-line block
  code = lines.filter(line => line.length > 0).join(" ");

  // 4. Syntactical Validation Check using the native browser JS parser engine
  try {
    // We pass the string to the Function constructor to test for critical syntax errors (e.g., missing brackets)
    // We wrap it in a structural check without running the actual script
    new Function(code);
  } catch (syntaxError) {
    return { 
      isValid: false, 
      error: `Syntax Verification Failed: ${syntaxError.message}`, 
      cleanCode: "" 
    };
  }

  // 5. Wrap the code in an IIFE block if it isn't already grouped. 
  // This isolates variables so they do not conflict with or crash the active webpage's native scripts.
  if (!code.startsWith("(function") && !code.startsWith("javascript:(function")) {
    code = `(function(){${code}})();`;
  }

  // 6. Prepend the definitive browser execution string protocol
  const finalExecutableBookmarklet = `javascript:${code}`;

  return {
    isValid: true,
    error: null,
    cleanCode: finalExecutableBookmarklet
  };
}
