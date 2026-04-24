import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERNAL_DOMAIN = 'dahlheritagehomes.com';

export const noInternalEmailValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value: string = control.value ?? '';

  if (!value) return null; // Let required handle empty

  if (!EMAIL_PATTERN.test(value)) return null; // Let email pattern handle format

  const domain = value.slice(value.lastIndexOf('@') + 1).toLowerCase();

  if (domain === INTERNAL_DOMAIN || domain.endsWith(`.${INTERNAL_DOMAIN}`)) {
    return { internalEmail: true };
  }

  return null;
};
