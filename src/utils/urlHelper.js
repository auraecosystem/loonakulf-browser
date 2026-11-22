export function isBlank(str) {
  return !str || str.trim().length === 0;
}

export function formatNavigationTarget(input) {
  if (isBlank(input)) return 'about:blank';

  const trimmed = input.trim();

  // Pass bookmarklets (javascript:...) through untouched
  if (trimmed.toLowerCase().startsWith('javascript:')) {
    return trimmed;
  }

  // Allow standard web URLs and internal about: pages
  if (
    trimmed.startsWith('about:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  // Prepend https:// if it looks like a domain
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }

  // Default to Google search
  return `https://google.com{encodeURIComponent(trimmed)}`;
}
