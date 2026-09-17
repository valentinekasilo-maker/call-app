/**
 * Utilities for 10-digit numeric App IDs.
 * Note: App IDs behave like phone numbers within the application,
 * but are purely internet identifiers and not real telephone numbers.
 */

/**
 * Validates if the given string is a valid 10-digit numeric App ID.
 */
export function isValidAppId(appId: string): boolean {
  if (typeof appId !== 'string') return false;
  return /^\d{10}$/.test(appId.trim());
}

/**
 * Cleans user input down to raw numeric characters (up to 10 digits).
 */
export function cleanAppId(input: string): string {
  if (!input) return '';
  return input.replace(/\D/g, '').slice(0, 10);
}

/**
 * Generates a random 10-digit numeric App ID.
 * Example formats: 0748321905, 0612884177, 0755123489
 */
export function generateAppId(): string {
  // Generate 10 random digits
  let result = '';
  // Ensure common friendly prefix like 07 or 06 or random digits
  const prefixes = ['07', '06', '08', '09', '01', '02', '03', '04', '05'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  result += prefix;
  while (result.length < 10) {
    const digit = Math.floor(Math.random() * 10);
    result += digit.toString();
  }
  return result;
}

/**
 * Formats a 10-digit App ID for human-readable display (e.g. "0748 321 905" or "0748-321-905").
 */
export function formatAppId(appId: string, separator: string = ' '): string {
  const cleaned = cleanAppId(appId);
  if (cleaned.length !== 10) return appId;
  return `${cleaned.slice(0, 4)}${separator}${cleaned.slice(4, 7)}${separator}${cleaned.slice(7, 10)}`;
}
