import { describe, expect, it } from 'vitest';
import { parseCsv } from './admin-service-import.component';

describe('service import CSV parsing', () => {
  it('preserves Tamil Unicode, phone and postal values as text', () => {
    expect(parseCsv('provider_name,phone,postal_code\r\nஅன்பு சேவைகள்,09876543210,060001')).toEqual([
      ['provider_name', 'phone', 'postal_code'],
      ['அன்பு சேவைகள்', '09876543210', '060001'],
    ]);
  });

  it('supports escaped quotes, quoted commas and multiline cells', () => {
    expect(parseCsv('name,description\nProvider,"Service, with ""care""\nand support"')).toEqual([
      ['name', 'description'], ['Provider', 'Service, with "care"\nand support'],
    ]);
  });

  it('rejects malformed CSV with an unterminated quote', () => {
    expect(() => parseCsv('name,description\nProvider,"unfinished')).toThrow('unclosed quoted field');
  });

  it('ignores empty records and handles a UTF-8 BOM in the first header', () => {
    expect(parseCsv('\uFEFFservice_name,location\n\nElectrical,Chidambaram\r\n')).toEqual([
      ['\uFEFFservice_name', 'location'], ['Electrical', 'Chidambaram'],
    ]);
  });
});
