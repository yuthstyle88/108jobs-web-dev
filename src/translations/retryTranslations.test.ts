import { describe, expect, it } from 'vitest';
import { en } from './en';
import { th } from './th';
import { vi } from './vi';

describe('retry and load failure translation keys', () => {
  const locales = [
    { name: 'en', dict: en, expectedRetry: 'Retry', expectedLoadFailed: 'An error occurred while loading data. Please try again.' },
    { name: 'th', dict: th, expectedRetry: 'ลองอีกครั้ง', expectedLoadFailed: 'เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง' },
    { name: 'vi', dict: vi, expectedRetry: 'Thử lại', expectedLoadFailed: 'Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.' },
  ];

  locales.forEach(({ name, dict, expectedRetry, expectedLoadFailed }) => {
    describe(`locale: ${name}`, () => {
      it('has global.buttonRetry defined and matching expected text', () => {
        expect(dict.translation?.global?.buttonRetry).toBeDefined();
        expect(typeof dict.translation?.global?.buttonRetry).toBe('string');
        expect(dict.translation?.global?.buttonRetry).toBe(expectedRetry);
      });

      it('has error.loadFailed defined and matching expected text', () => {
        expect(dict.translation?.error?.loadFailed).toBeDefined();
        expect(typeof dict.translation?.error?.loadFailed).toBe('string');
        expect(dict.translation?.error?.loadFailed).toBe(expectedLoadFailed);
      });

      it('keeps error.limitSendEmail distinct from error.loadFailed', () => {
        expect(dict.translation?.error?.limitSendEmail).toBeDefined();
        expect(dict.translation?.error?.limitSendEmail).not.toBe(dict.translation?.error?.loadFailed);
      });

      it('has error.serverError defined', () => {
        expect(dict.translation?.error?.serverError).toBeDefined();
        expect(typeof dict.translation?.error?.serverError).toBe('string');
      });
    });
  });
});
