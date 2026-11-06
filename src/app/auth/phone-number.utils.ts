export interface PhoneCountry {
  readonly code: string;
  readonly dialCode: string;
  readonly name: string;
  readonly flag: string;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳' },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AE', dialCode: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'AU', dialCode: '+61', name: 'Australia', flag: '🇦🇺' },
] as const;

export function normalizePhoneNumber(country: PhoneCountry, input: string): string | null {
  const digits = input.replace(/[\s().-]/g, '');
  if (!/^\d+$/.test(digits)) return null;

  if (country.code === 'IN') {
    return /^[6-9]\d{9}$/.test(digits) ? `${country.dialCode}${digits}` : null;
  }

  const withoutTrunkPrefix = digits.startsWith('0') ? digits.slice(1) : digits;
  return withoutTrunkPrefix.length >= 7 && withoutTrunkPrefix.length <= 15
    ? `${country.dialCode}${withoutTrunkPrefix}`
    : null;
}

export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}
