export type PasswordStrength = 'weak' | 'medium' | 'strong';

// A simple, transparent heuristic (not a policy check - the backend already
// enforces the real minimum) purely to give visual feedback as the user types.
export function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) {
    return null;
  }

  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) {
    return 'weak';
  }

  if (score <= 3) {
    return 'medium';
  }

  return 'strong';
}
