export interface ServiceCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface CapturedServiceCoordinates extends ServiceCoordinates {
  readonly accuracy: number;
}

export type ServiceLocationSource = 'gps' | 'google_maps_link';

export interface ValidatedGoogleMapsLocation {
  readonly url: string;
  readonly coordinates: ServiceCoordinates | null;
}

export type LocationCaptureFailure = 'denied' | 'timeout' | 'unavailable' | 'unsupported';

export class LocationCaptureError extends Error {
  constructor(readonly reason: LocationCaptureFailure) {
    super(reason);
    this.name = 'LocationCaptureError';
  }
}

export function isValidServiceCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number'
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && typeof longitude === 'number'
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180;
}

export function googleMapsDirectionsUrl(latitude: number | null | undefined, longitude: number | null | undefined): string | null {
  if (!isValidServiceCoordinates(latitude, longitude)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

const GOOGLE_MAPS_HOSTS = new Set([
  'google.com', 'www.google.com', 'maps.google.com',
  'google.co.in', 'www.google.co.in', 'maps.google.co.in',
  'google.co.uk', 'www.google.co.uk', 'maps.google.co.uk',
  'google.ca', 'www.google.ca', 'maps.google.ca',
  'google.com.au', 'www.google.com.au', 'maps.google.com.au',
  'google.de', 'www.google.de', 'maps.google.de',
  'google.fr', 'www.google.fr', 'maps.google.fr',
  'google.co.jp', 'www.google.co.jp', 'maps.google.co.jp',
]);

const GOOGLE_MAPS_QUERY_KEYS = ['q', 'query', 'll', 'center', 'destination', 'daddr'] as const;
const COORDINATE_PAIR = /^\s*([+-]?\d{1,3}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/;

export function validateGoogleMapsLocationUrl(value: string): ValidatedGoogleMapsLocation | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;

  const isAppShortLink = url.hostname === 'maps.app.goo.gl' && /^\/[A-Za-z\d_-]+\/?$/.test(url.pathname);
  const isLegacyShortLink = url.hostname === 'goo.gl' && /^\/maps\/[A-Za-z\d_-]+\/?$/.test(url.pathname);
  const hasLocationQuery = GOOGLE_MAPS_QUERY_KEYS.some(key => Boolean(url.searchParams.get(key)?.trim()));
  const hasLocationPath = /^\/maps\/(?:place\/[^/]+|search\/[^/]+|@[^/]+|dir\/[^/]+)/i.test(url.pathname);
  const isGoogleMapsPage = GOOGLE_MAPS_HOSTS.has(url.hostname) && (
    hasLocationPath
    || (/^\/maps\/?$/i.test(url.pathname) && hasLocationQuery)
    || (url.hostname.startsWith('maps.') && url.pathname === '/' && hasLocationQuery)
    || (/^\/maps\/search\/?$/i.test(url.pathname) && hasLocationQuery)
    || (/^\/maps\/dir\/?$/i.test(url.pathname) && Boolean(url.searchParams.get('destination')?.trim()))
  );

  if (!isAppShortLink && !isLegacyShortLink && !isGoogleMapsPage) return null;

  return { url: url.href, coordinates: isAppShortLink || isLegacyShortLink ? null : extractCoordinates(url) };
}

function extractCoordinates(url: URL): ServiceCoordinates | null {
  const found = new Map<string, ServiceCoordinates>();
  const addPair = (value: string | null | undefined): void => {
    if (!value) return;
    const match = COORDINATE_PAIR.exec(value);
    if (!match) return;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!isValidServiceCoordinates(latitude, longitude)) return;
    found.set(`${latitude},${longitude}`, { latitude, longitude });
  };

  for (const match of url.pathname.matchAll(/@([+-]?\d{1,3}(?:\.\d+)?),([+-]?\d{1,3}(?:\.\d+)?)/g)) {
    addPair(`${match[1]},${match[2]}`);
  }
  const placeCoordinates = url.pathname.match(/\/(?:place|search)\/([^/]+)/i)?.[1];
  if (placeCoordinates) {
    try { addPair(decodeURIComponent(placeCoordinates)); } catch { /* Ignore malformed path encoding. */ }
  }
  for (const key of GOOGLE_MAPS_QUERY_KEYS) addPair(url.searchParams.get(key));
  for (const match of url.href.matchAll(/!3d([+-]?\d{1,3}(?:\.\d+)?)!4d([+-]?\d{1,3}(?:\.\d+)?)/g)) {
    addPair(`${match[1]},${match[2]}`);
  }

  return found.size === 1 ? [...found.values()][0] : null;
}

/** Invoke only in response to an explicit user action; never call this automatically. */
export function requestCurrentServiceLocation(
  geolocation: Pick<Geolocation, 'getCurrentPosition'> | null | undefined,
): Promise<CapturedServiceCoordinates> {
  if (!geolocation) return Promise.reject(new LocationCaptureError('unsupported'));

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!isValidServiceCoordinates(latitude, longitude) || !Number.isFinite(accuracy) || accuracy < 0) {
          reject(new LocationCaptureError('unavailable'));
          return;
        }
        resolve({ latitude, longitude, accuracy });
      },
      error => {
        const reason: LocationCaptureFailure = error.code === 1
          ? 'denied'
          : error.code === 3
            ? 'timeout'
            : 'unavailable';
        reject(new LocationCaptureError(reason));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
