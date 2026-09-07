import { toCamelCaseLastSegment } from "@/utils/helpers";

/** The subset of a category this label needs. */
export interface LabelledCategory {
  path?: string;
  title?: string;
  name?: string;
}

/** The shape of react-i18next's `t` that this helper depends on. */
type Translate = (key: string, opts?: { defaultValue?: string }) => string;

/**
 * A readable name for a category.
 *
 * Categories are labelled from the translation catalogue, keyed off the last
 * segment of the ltree `path` (`0.logo_design` → `catalogs.logoDesign`). That
 * is fine for the seeded catalogue and wrong for everything added since: `t`
 * echoes the key back when there is no entry for it, so the job board rendered
 * the literal string `catalogs.0` where a name should be. The `|| "-"` guard
 * at the call sites never fired, because an echoed key is a non-empty string.
 *
 * The server already sends a human-readable `title` (and `name`) in the same
 * payload, so use those as the default rather than showing a key. Adding a
 * category no longer requires shipping a translation for it to be legible.
 */
export function categoryLabel(
  t: Translate,
  category: LabelledCategory | null | undefined,
): string {
  const fallback =
    category?.title?.trim() || category?.name?.trim() || "-";

  if (!category?.path) return fallback;

  const key = `catalogs.${toCamelCaseLastSegment(category.path)}`;
  const translated = t(key, { defaultValue: fallback });

  // Belt and braces: a `t` configured to ignore `defaultValue` would still
  // hand back the key, and a raw key on screen is the bug being fixed.
  if (!translated || translated === key) return fallback;
  return translated;
}
