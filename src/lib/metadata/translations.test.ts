import { describe, expect, it } from 'vitest';
import { seoTranslations } from './translations';
import { getProfilePrefix, PRODUCT_NAME, PRODUCT_SUPPORT_EMAIL } from '@/config/product';
import { getAppName, getAppUrl } from '@/utils/appConfig';

describe('Branding and Metadata Translations', () => {
  it('does not contain hardcoded 108heros.com in any locale translations', () => {
    const json = JSON.stringify(seoTranslations);
    expect(json).not.toContain('108heros.com');
  });

  it('builds login titles across all locales from the product name', () => {
    // Assert the relationship, not a literal: the titles interpolate
    // getAppName(), whose fallback is the rebranded name after 660d682
    // (2026-08-25) and the owner's 2026-09-09 call. Pinning the literal here is
    // what made this test fail the moment the rename it was written alongside
    // actually landed.
    const name = getAppName();
    expect(seoTranslations.th.login.title).toContain(name);
    expect(seoTranslations.en.login.title).toBe(`Authentication to ${name}`);
    expect(seoTranslations.vi.login.title).toBe(`Đăng nhập ${name}`);
  });

  it('provides single-source product constants', () => {
    // PRODUCT_* are still literals carrying the domain, which is deliberately
    // NOT renamed (.108jobs.com serves other systems). getAppName() carries the
    // displayed product name, which is. They differ on purpose; see #172.
    expect(PRODUCT_NAME).toBe('108jobs.com');
    expect(PRODUCT_SUPPORT_EMAIL).toBe('support@108jobs.com');
    expect(getProfilePrefix()).toBe(`${getAppName()}/profile/`);
    expect(getAppName()).toBe('108Heros');
    expect(getAppUrl()).toBe('https://108jobs.com');
  });
});
