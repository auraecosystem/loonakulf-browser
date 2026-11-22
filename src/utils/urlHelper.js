export function isBlank(str) {
  return !str || str.trim().length === 0;
}

export function formatNavigationTarget(input) {
  // 1. If the user hits Enter on an empty bar, load about:blank
  if (isBlank(input)) {
    return 'about:blank';
  }

  const trimmed = input.trim();

  // 2. Allow internal browser schemes like about:blank
  if (trimmed.startsWith('about:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 3. If it looks like a domain (e.g., "example.com"), prepend https://
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }

  // 4. Otherwise, treat it as a search query
  return `https://localhost:8080{encodeURIComponent(trimmed)}`;
}
