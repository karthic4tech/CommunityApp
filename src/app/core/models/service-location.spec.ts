import { googleMapsDirectionsUrl, isValidServiceCoordinates, requestCurrentServiceLocation, validateGoogleMapsLocationUrl } from './service-location';
import { vi } from 'vitest';

describe('service location helpers', () => {
  it('validates geographic coordinate ranges and finite values', () => {
    expect(isValidServiceCoordinates(0, 0)).toBe(true);
    expect(isValidServiceCoordinates(-90, 180)).toBe(true);
    expect(isValidServiceCoordinates(90.01, 0)).toBe(false);
    expect(isValidServiceCoordinates(0, -181)).toBe(false);
    expect(isValidServiceCoordinates(Number.NaN, 0)).toBe(false);
  });

  it('creates a directions URL without requesting the customer location', () => {
    expect(googleMapsDirectionsUrl(11.399, 79.691)).toBe('https://www.google.com/maps/dir/?api=1&destination=11.399,79.691');
    expect(googleMapsDirectionsUrl(null, 79.691)).toBeNull();
    expect(googleMapsDirectionsUrl(91, 79.691)).toBeNull();
  });

  it('accepts trusted Google Maps URLs and extracts only unambiguous coordinates', () => {
    expect(validateGoogleMapsLocationUrl('https://maps.app.goo.gl/AbC_123')?.coordinates).toBeNull();
    expect(validateGoogleMapsLocationUrl('https://www.google.com/maps/place/Shop/@11.399,79.691,17z')?.coordinates).toEqual({ latitude: 11.399, longitude: 79.691 });
    expect(validateGoogleMapsLocationUrl('https://maps.google.co.in/?q=11.399%2C79.691')?.coordinates).toEqual({ latitude: 11.399, longitude: 79.691 });
    expect(validateGoogleMapsLocationUrl('https://www.google.com/maps/dir/?origin=10,70&destination=11,79')?.coordinates).toEqual({ latitude: 11, longitude: 79 });
    expect(validateGoogleMapsLocationUrl('https://www.google.com/maps/dir/?destination=11,79&query=12,80')?.coordinates).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'http://www.google.com/maps/place/Shop',
    'https://google.com.evil.example/maps/place/Shop',
    'https://www.google.com@evil.example/maps/place/Shop',
    'https://www.google.com/url?q=https://maps.google.com/maps',
    'https://maps.google.com.evil.example/?q=11,79',
    'https://www.google.com/maps',
    'https://maps.google.com/',
  ])('rejects an unsafe or unsupported Maps URL: %s', value => {
    expect(validateGoogleMapsLocationUrl(value)).toBeNull();
  });

  it('requests high-accuracy location with bounded timeout and preserves reported accuracy', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: 11.399, longitude: 79.691, accuracy: 42 },
      timestamp: 0,
    } as GeolocationPosition));

    await expect(requestCurrentServiceLocation({ getCurrentPosition })).resolves.toEqual({ latitude: 11.399, longitude: 79.691, accuracy: 42 });
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ] as const)('maps browser geolocation error %s to %s', async (code, reason) => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => error({ code, message: 'GPS error' } as GeolocationPositionError));
    await expect(requestCurrentServiceLocation({ getCurrentPosition })).rejects.toMatchObject({ reason });
  });

  it('reports unsupported geolocation and accepts poor accuracy for explicit provider confirmation', async () => {
    await expect(requestCurrentServiceLocation(undefined)).rejects.toMatchObject({ reason: 'unsupported' });
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: 11.399, longitude: 79.691, accuracy: 850 },
      timestamp: 0,
    } as GeolocationPosition));
    await expect(requestCurrentServiceLocation({ getCurrentPosition })).resolves.toMatchObject({ accuracy: 850 });
  });
});
