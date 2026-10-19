// India-only phone field. `pattern` is the 10-digit mobile number without the
// +91/0 prefix; the API's DTOs enforce the same rule server side.
export const PHONE_CODE = '+91';
export const PHONE_PATTERN = '[6-9][0-9]{9}';
export const PHONE_LENGTH = 10;
export const PHONE_PLACEHOLDER = '9876543210';

// Takes a stored phone ("+91 9876543210", or an older free-typed value like
// "098765-43210" / "919876543210") and returns just the 10-digit number.
export function phoneDigits(value: string): string {
  const trimmed = (value ?? '').trim();
  // Our own format: drop the prefix first, so a half-typed "+91 98" gives "98"
  // and the 91 never leaks into the number box.
  if (trimmed.startsWith(PHONE_CODE)) {
    return trimmed.slice(PHONE_CODE.length).replace(/\D/g, '');
  }

  let digits = trimmed.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}
