import {isBrowser} from "@/utils/browser";
import i18next, {BackendModule, ReadCallback, Resource} from "i18next";
import {ImportReport} from "@/utils/dynamic-imports";
import {en} from "@/translations/en";
import {vi} from "@/translations/vi";
import {setupDateFns} from "@/utils/date";
import {MyUserInfo} from "108heros-client";

export type TranslationDesc = {
  resource: string;
  code: string;
  name: string;
  bundled?: boolean;
};

export const languages: TranslationDesc[] = [
  {resource: "en", code: "en", name: "English", bundled: true},
  {resource: "th", code: "th", name: "ไทย"},
  {resource: "vi", code: "vi", name: "Tiếng Việt"},
];

const languageByCode = languages.reduce<Record<string, TranslationDesc>>(
  (acc, l) => {
    acc[l.code] = l;
    return acc;
  },
  {}
);

// Use pt-BR for users with removed interface language pt_BR.
languageByCode["en_US"] = languageByCode["en-US"];

async function load(translation: TranslationDesc): Promise<Resource> {
  const {resource} = translation;
  return import(
    /* webpackChunkName: `translation-[request]`  */
    `../translations/${resource}`
    ).then(x => x[resource]);
}

export async function verifyTranslationImports(): Promise<ImportReport> {
  const report = new ImportReport();
  const promises = languages.map((lang) =>
    load(lang)
    .then((x) => {
      if (x && x["translation"]) {
        report.success.push(lang.code);
      } else {
        throw "unexpected format";
      }
    })
    .catch((err) => report.error.push({id: lang.code, error: err}))
  );
  await Promise.all(promises);
  return report;
}

export function pickTranslations(lang: string): TranslationDesc[] | undefined {
  const primary = languageByCode[lang];
  const [head] = (primary?.code ?? lang).split("-");
  const secondary = head !== lang ? languageByCode[head] : undefined;
  if (primary && secondary) {
    return [primary, secondary];
  } else if (primary) {
    return [primary];
  } else if (secondary) {
    return [secondary];
  }
  return undefined;
}

export function findTranslationChunkNames(
  languages: readonly string[]
): string[] {
  for (const lang of languages) {
    const translations = pickTranslations(lang);
    if (!translations) {
      continue;
    }
    return translations
    .filter((x) => !x.bundled)
    .map((x) => `translation-${x.resource}`);
  }
  return [];
}

export async function loadUserLanguage() {
  await new Promise((r) => I18NextService.i18n.changeLanguage(undefined,
    r));
  await setupDateFns();
}

function format(value: any, format: any): any {
  return format === "uppercase" ? value.toUpperCase() : value;
}

class LanguageDetector {
  static readonly type = "languageDetector";

  detect() {
    return LanguageService.userLanguages();
  }
}

export class LanguageService {
  private static _serverLanguages: readonly string[] = [];

  private static get languages(): readonly string[] {
    if (isBrowser()) {
      return navigator.languages;
    } else {
      return this._serverLanguages;
    }
  }

  static updateLanguages(languages: readonly string[]) {
    this._serverLanguages = languages;
    I18NextService.i18n.changeLanguage();
    setupDateFns();
  }

  static userLanguages(myUserInfo?: MyUserInfo): readonly string[] {
    const myLang =
      myUserInfo?.localUserView?.localUser?.interfaceLanguage ?? "browser";
    if (myLang === "browser") {
      return this.languages;
    }
    return [myLang, ...this.languages];
  }
}

class LazyLoader implements Omit<BackendModule, "type"> {
  static readonly type = "backend";

  init() {}

  read(language: string, namespace: string, cb: ReadCallback): void {
    const translation: TranslationDesc = languageByCode[language];
    if (!translation) {
      cb(new Error(`No translation found: ${language} ${namespace}`),
        false);
      return;
    }
    load(translation)
    .then(data => {
      const resKeys = data && data[namespace];
      if (!resKeys) throw Error(`Failed loading: ${language} ${namespace}`);
      cb(null,
        resKeys);
    })
    .catch(err => cb(err,
      false));
  }
}

export class I18NextService {
  static #instance: I18NextService;
  #i18n: typeof i18next;

  private constructor() {
    this.#i18n = i18next;

  }
  public static async init() {
    const instance = new I18NextService();
    // Build the i18next plugin chain conditionally to avoid importing react-i18next on the server.
    let chain = instance.#i18n.use(LanguageDetector);
    if (isBrowser()) {
      // Important: connect i18next to React so components re-render on language change (client-only)
      const { initReactI18next } = await import("react-i18next");
      chain = chain.use(initReactI18next);
    }
    chain = chain.use(LazyLoader);

    const baseOptions: any = {
      debug: false,
      compatibilityJSON: "v4",
      supportedLngs: languages.map((l) => l.code),
      nonExplicitSupportedLngs: true,
      load: "all",
      // initImmediate: false,
      fallbackLng: ["en"],
      // Use all namespaces available in en.ts
      ns: Object.keys(en),
      resources: {en} as Resource,
      interpolation: {format},
      partialBundledLanguages: true,
    };
    if (isBrowser()) {
      // React-specific options ensure UI updates without Suspense stalls
      baseOptions.react = {
        useSuspense: false,
        bindI18n: "languageChanged loaded",
        bindI18nStore: "added removed",
      };
    }

    await chain.init(baseOptions);
    instance.#i18n.on('missingKey', (lng, namespace, key, fallbackValue) => {
      console.warn(lng, namespace, key, fallbackValue);
    })
    this.#instance = instance;
  }
  public static get i18n() {
    if (!this.#instance) throw new Error("I18NextService not initialized");
    return this.#instance.#i18n;
  }

  static get #Instance() {
    return this.#instance ?? (this.#instance = new this());
  }
}
