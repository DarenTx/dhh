const STORAGE_KEY = 'auth_redirect_destination';

function isValidDestination(path: string): boolean {
  if (!path) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('/login')) return false;
  if (path.startsWith('http') || path.startsWith('//') || path.includes('..')) return false;
  return true;
}

export function storeRedirectDestination(path: string): void {
  const destination = isValidDestination(path) ? path : '/';
  sessionStorage.setItem(STORAGE_KEY, destination);
}

export function consumeRedirectDestination(): string {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  return isValidDestination(stored ?? '') ? (stored as string) : '/';
}
