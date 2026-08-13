// Turns a failed API call into text worth showing someone, instead of a
// generic "something went wrong" for anything the caller didn't specifically
// anticipate. Mirrors 108jobs-flutter's errorMessageFor()/friendlyError()
// (lib/core/extensions/global_error_extension.dart, lib/shared/errors/friendly_error.dart):
// known code -> mapped message; else a plain 4xx's own server-provided
// `message` is shown verbatim (it's the difference between "it broke" and
// something a user or support can act on); else a generic fallback with the
// raw code appended in parens so it's at least searchable.
import {ApiError} from "@/services/HttpService";

export interface ResolveErrorMessageOptions {
    /** Domain-specific known-code -> friendly message, checked first (e.g. OTP's invalid_code). */
    knownCodes?: Record<string, string>;
    /** Shown for a 501 specifically. Defaults to t("error.notAvailableYet"). */
    notAvailableYetMessage?: string;
    /** Generic catch-all. Defaults to t("error.serverError"). */
    fallback?: string;
}

const SERVER_MESSAGE_MAX_LENGTH = 160;

export function resolveApiErrorMessage(
    err: ApiError | undefined,
    t: (key: string, options?: Record<string, unknown>) => string,
    options: ResolveErrorMessageOptions = {},
): string {
    if (err?.status === 501) {
        return options.notAvailableYetMessage ?? t("error.notAvailableYet");
    }

    const code = err?.error ?? err?.name;
    if (code && options.knownCodes?.[code]) {
        return options.knownCodes[code];
    }

    const isPlainClientError = err?.status !== undefined && err.status >= 400 && err.status < 500;
    if (isPlainClientError && err?.message && err.message.length <= SERVER_MESSAGE_MAX_LENGTH) {
        return err.message;
    }

    const fallback = options.fallback ?? t("error.serverError");
    if (code && !fallback.includes(code)) {
        return `${fallback} (${code})`;
    }
    return fallback;
}
