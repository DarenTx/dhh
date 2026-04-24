import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { noInternalEmailValidator } from './no-internal-email.validator';

function validate(value: string) {
  const ctrl = new FormControl(value);
  return noInternalEmailValidator(ctrl);
}

describe('noInternalEmailValidator', () => {
  it('returns null for empty string (let required handle it)', () => {
    expect(validate('')).toBeNull();
  });

  it('returns null for invalid email format (let email validator handle it)', () => {
    expect(validate('not-an-email')).toBeNull();
  });

  it('returns null for valid external email', () => {
    expect(validate('user@gmail.com')).toBeNull();
  });

  it('returns internalEmail error for exact internal domain', () => {
    expect(validate('user@dahlheritagehomes.com')).toEqual({ internalEmail: true });
  });

  it('returns internalEmail error for subdomain of internal domain', () => {
    expect(validate('user@sub.dahlheritagehomes.com')).toEqual({ internalEmail: true });
  });

  it('returns internalEmail error for deeply nested subdomain', () => {
    expect(validate('user@a.b.dahlheritagehomes.com')).toEqual({ internalEmail: true });
  });

  it('is case-insensitive for domain check', () => {
    expect(validate('user@DahlHeritageHomes.COM')).toEqual({ internalEmail: true });
    expect(validate('user@Sub.DahlHeritageHomes.com')).toEqual({ internalEmail: true });
  });

  it('returns null for a domain that merely contains the internal domain as a substring', () => {
    expect(validate('user@notdahlheritagehomes.com')).toBeNull();
  });
});
