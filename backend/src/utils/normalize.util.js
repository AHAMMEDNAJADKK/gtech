/**
 * Utilities for normalizing student and user identity fields
 */

/**
 * Normalizes phone numbers for consistent duplicate detection and storage.
 * Strips whitespace, hyphens, parentheses, and leading country code '+91' or '0' for 10-digit Indian numbers.
 * E.g. '+91 98765-43210', '09876543210', '9876543210' -> '9876543210'
 */
export const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
};

/**
 * Normalizes email address for consistent comparison.
 */
export const normalizeEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};

/**
 * Normalizes official identity number (Aadhaar, PAN Card, etc.).
 * Strips whitespace and hyphens, converts to uppercase.
 */
export const normalizeIdentityNumber = (idNum) => {
  return String(idNum || '').replace(/[\s-]/g, '').trim().toUpperCase();
};

/**
 * Generates an array of phone format variants for MongoDB query matching
 * to detect duplicates across stored formats (raw, normalized, prefixed).
 */
export const buildPhoneMatchVariants = (phone) => {
  if (!phone) return [];
  const raw = String(phone).trim();
  const norm = normalizePhone(phone);
  const variants = new Set([raw]);
  if (norm) {
    variants.add(norm);
    variants.add(`+91${norm}`);
    variants.add(`+91 ${norm}`);
    variants.add(`0${norm}`);
    variants.add(`91${norm}`);
  }
  return Array.from(variants);
};
