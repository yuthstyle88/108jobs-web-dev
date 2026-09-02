import { describe, expect, it } from 'vitest';
import { seoTranslations } from './translations';
import { getProfilePrefix, PRODUCT_NAME, PRODUCT_SUPPORT_EMAIL } from '@/config/product';
import { getAppName, getAppUrl } from '@/utils/appConfig';

describe('Branding and Metadata Translations', () => {
  it('does not contain hardcoded 108heros.com in any locale translations', () => {
    const json = JSON.stringify(seoTranslations);
    expect(json).not.toContain('108heros.com');
  });

  it('contains proper 108jobs.com login titles across all locales', () => {
    expect(seoTranslations.th.login.title).toContain('108jobs.com');
    expect(seoTranslations.en.login.title).toBe('Authentication to 108jobs.com');
    expect(seoTranslations.vi.login.title).toBe('Đăng nhập 108jobs.com');
  });

  it('provides single-source product constants', () => {
    expect(PRODUCT_NAME).toBe('108jobs.com');
    expect(PRODUCT_SUPPORT_EMAIL).toBe('support@108jobs.com');
    expect(getProfilePrefix()).toBe('108jobs.com/profile/');
    expect(getAppName()).toBe('108jobs.com');
    expect(getAppUrl()).toBe('https://108jobs.com');
  });
});
