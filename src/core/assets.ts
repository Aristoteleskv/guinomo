declare global {
  interface Window {
    APP_URL_PATH?: string;
    CSRF_TOKEN?: string;
    GUINOMO_ASSET_BASE?: string;
    GUINOMO_UID?: number;
    GUINOMO_PROFILE?: {
      username: string;
      avatarUrl: string;
      profileUrl: string;
    };
  }
}

export function assetUrl(path: string): string {
  const base = window.GUINOMO_ASSET_BASE
    ? new URL(window.GUINOMO_ASSET_BASE, window.location.origin).toString()
    : window.location.href;
  return new URL(path, base).toString();
}

export function appEndpointUrl(path: string): string {
  const appPath = (window.APP_URL_PATH || '').replace(/\/+$/, '');
  const endpoint = path.replace(/^\/+/, '');
  return new URL(`${appPath}/${endpoint}`, window.location.origin).toString();
}
