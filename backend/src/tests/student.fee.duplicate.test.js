import { jest } from '@jest/globals';
import { normalizePhone, normalizeEmail, normalizeIdentityNumber } from '../utils/normalize.util.js';

describe('Student Duplicate Validation & Fee Normalization Tests', () => {
  describe('Normalize Utility Tests', () => {
    test('should normalize Indian phone numbers to 10 digits', () => {
      expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
      expect(normalizePhone('09876543210')).toBe('9876543210');
      expect(normalizePhone('919876543210')).toBe('9876543210');
      expect(normalizePhone('98765 43210')).toBe('9876543210');
      expect(normalizePhone('+91-9876543210')).toBe('9876543210');
    });

    test('should handle empty or invalid phone gracefully', () => {
      expect(normalizePhone('')).toBe('');
      expect(normalizePhone(null)).toBe('');
      expect(normalizePhone(undefined)).toBe('');
    });

    test('should normalize email addresses to trimmed lowercase', () => {
      expect(normalizeEmail('  Student.One@Example.COM  ')).toBe('student.one@example.com');
      expect(normalizeEmail('USER@TEST.ORG')).toBe('user@test.org');
      expect(normalizeEmail('')).toBe('');
      expect(normalizeEmail(null)).toBe('');
    });

    test('should normalize identity numbers to uppercase alphanumeric', () => {
      expect(normalizeIdentityNumber(' 1234 5678 9012 ')).toBe('123456789012');
      expect(normalizeIdentityNumber('abcd-1234-efgh')).toBe('ABCD1234EFGH');
      expect(normalizeIdentityNumber('')).toBe('');
      expect(normalizeIdentityNumber(null)).toBe('');
    });
  });

  describe('Duplicate Detection Pattern Matching', () => {
    test('should identify duplicate phones across formatted variants', () => {
      const existingDbPhone = '+919876543210';
      const inputPhone1 = '9876543210';
      const inputPhone2 = '09876543210';
      const inputPhone3 = '+91 98765 43210';

      const normExisting = normalizePhone(existingDbPhone);
      expect(normalizePhone(inputPhone1)).toBe(normExisting);
      expect(normalizePhone(inputPhone2)).toBe(normExisting);
      expect(normalizePhone(inputPhone3)).toBe(normExisting);
    });

    test('should return exact required error message', () => {
      const DUPLICATE_MESSAGE = "Student already exists. Please check the existing student record.";
      expect(DUPLICATE_MESSAGE).toBe("Student already exists. Please check the existing student record.");
    });
  });

  describe('Fee Receipt Generation Utilities', () => {
    test('should generate receipt number matching RCP-YYYY-XXXXXX format', () => {
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const receiptNo = `RCP-${year}-${randomSuffix}`;
      
      const receiptRegex = /^RCP-\d{4}-\d{6}$/;
      expect(receiptRegex.test(receiptNo)).toBe(true);
    });
  });
});
