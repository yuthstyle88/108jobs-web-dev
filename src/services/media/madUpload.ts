import {UserService} from "@/services/UserService";

/**
 * Where an uploaded file may be read from.
 *
 * `/account/files` has no such concept — everything it stores is served from
 * one route to anyone holding the URL. MAD does, and it is decided at upload
 * time, so it belongs on the call rather than inside whichever backend happens
 * to be wired in.
 */
export type MediaVisibility = "private" | "public";

/**
 * What kind of asset is being uploaded. MAD partitions storage/serving
 * behaviour by this — `"image"` assets may get rendition processing,
 * `"file"` assets are stored and served verbatim (documents, etc.).
 */
export type MediaKind = "image" | "file";

/** What every upload path here returns, matching the legacy `/account/files`
 *  response so call sites do not care which one ran. */
export type UploadedAsset = {
  url: string;
  /**
   * The handle the storage backend knows this by — the asset id on MAD, a
   * real filename on the legacy path. It is what deletion is keyed on, which
   * is why it is not the display name.
   */
  filename: string;
  size: number;
  mimeType?: string;
  /**
   * MAD's asset id, named for what it is. Callers need it explicitly: it goes
   * in the chat envelope so the server can persist `chat_message.asset_id`
   * without reading encrypted content, and `media_proxy` resolves the owning
   * room from that column to check membership.
   */
  assetId?: string;
  /**
   * The name the user's file actually had. MAD has no filename concept — the
   * upload contract accepts only kind/length/content-type/visibility — so
   * nothing recovers this if the caller drops it here.
   */
  originalFilename?: string;
};

const trimSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * MAD's gateway, or `null` when `.env` does not name one.
 *
 * `null` is the state in every environment today, including CI, and it is what
 * keeps this whole module inert until somebody deploys MAD and sets the key.
 * Next.js inlines `NEXT_PUBLIC_*` at build time, so this is decided when the
 * bundle is built, not per request.
 */
export function madGatewayUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL?.trim();
  return value ? trimSlash(value) : null;
}

/** Base a browser resolves a public asset against; falls back to the gateway,
 *  which is correct when one host serves both. */
function madPublicUrl(gateway: string): string {
  const value = process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL?.trim();
  return value ? trimSlash(value) : gateway;
}

async function madJson<T>(
  url: string,
  init: RequestInit & {token: string},
): Promise<T> {
  const {token, ...rest} = init;
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `MAD ${init.method ?? "GET"} ${url} failed: ${response.status}`,
    );
  }
  return response.status === 204
    ? ({} as T)
    : ((await response.json()) as T);
}

/** Options for the byte-streaming leg of {@link uploadToMad}. The session-open
 *  and complete calls are single small JSON round trips with nothing worth
 *  reporting progress on or cancelling mid-flight, so neither field applies
 *  to them. */
export type UploadToMadOptions = {
  /**
   * Fraction of the byte upload sent so far, in `[0, 1]`. Only invoked when
   * the browser can compute it (`ProgressEvent.lengthComputable`) — a `File`
   * body's size is known up front, so in practice this fires for every
   * upload, but the check is kept honest rather than assumed, so a caller
   * never sees `NaN` or a fabricated percentage.
   */
  onProgress?: (fraction: number) => void;
  /**
   * Lets a caller cancel an in-flight upload — e.g. the composer's remove
   * button while a just-picked file is still uploading. Rejects with a
   * `DOMException` named `"AbortError"`, matching what `fetch` itself does
   * for an aborted `signal`, so a caller can tell a deliberate cancel apart
   * from a real failure with the same `error.name` check it would already
   * use for `fetch`.
   */
  signal?: AbortSignal;
};

/**
 * Streams `file` to `url` over `XMLHttpRequest` rather than `fetch`.
 *
 * `fetch` has no request-side progress events at all — there is nothing in
 * the Fetch API that reports bytes already sent, only bytes received back.
 * `XMLHttpRequest.upload.onprogress` is the one DOM API that does, which is
 * why this single leg of an otherwise all-`fetch` handshake is different.
 */
function uploadBytesWithProgress(
  url: string,
  token: string,
  contentType: string,
  file: File,
  options?: UploadToMadOptions,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const signal = options?.signal;

    const onAbort = () => xhr.abort();
    const detachAbort = () => signal?.removeEventListener("abort", onAbort);

    xhr.upload.onprogress = (event) => {
      if (!options?.onProgress) return;
      // `lengthComputable` false means the browser could not determine the
      // total size -- reporting a fraction against an unknown denominator
      // would be a fabricated number, so this skips the callback entirely
      // rather than emitting NaN or a bogus percentage.
      if (!event.lengthComputable || event.total <= 0) return;
      options.onProgress(event.loaded / event.total);
    };

    xhr.onload = () => {
      detachAbort();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`MAD byte upload failed: ${xhr.status}`));
      }
    };
    // No HTTP response at all (offline, DNS failure, CORS rejection, …).
    // `xhr.status` is 0 here, which keeps this on the exact same message
    // shape the non-2xx branch above uses rather than a differently-worded
    // error a caller would need a second check for.
    xhr.onerror = () => {
      detachAbort();
      reject(new Error(`MAD byte upload failed: ${xhr.status}`));
    };
    xhr.onabort = () => {
      detachAbort();
      reject(new DOMException("MAD byte upload aborted", "AbortError"));
    };

    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("content-type", contentType);

    if (signal) {
      if (signal.aborted) {
        // Already cancelled before this leg ever opened a connection --
        // reject the same way a mid-flight abort would, without sending
        // anything.
        reject(new DOMException("MAD byte upload aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort);
    }

    xhr.send(file);
  });
}

/**
 * Upload one file to MAD and return where it now lives.
 *
 * Three calls, because that is MAD's contract: open a session, stream the
 * bytes into it, complete it into an asset. Splitting it that way is what lets
 * the gateway authorise and size-check before any bytes move.
 *
 * The bearer is the caller's own Identity-Platform token — MAD's gateway
 * resolves the owner from it and there is no service-account path around that,
 * so an upload without a session cannot succeed and says so here rather than
 * surfacing a 401 from two calls in.
 */
export async function uploadToMad(
  file: File,
  visibility: MediaVisibility,
  kind: MediaKind = "image",
  options?: UploadToMadOptions,
): Promise<UploadedAsset> {
  const gateway = madGatewayUrl();
  if (!gateway) {
    throw new Error("MAD is not configured; NEXT_PUBLIC_MEDIA_GATEWAY_URL is unset");
  }

  const token = UserService.Instance?.authInfo?.auth;
  if (!token) {
    throw new Error("Cannot upload to MAD without a signed-in session");
  }

  const contentType = file.type || "application/octet-stream";

  const session = await madJson<{sessionId: string}>(`${gateway}/uploads`, {
    method: "POST",
    token,
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      kind,
      declaredContentLength: file.size,
      contentType,
      visibility,
    }),
  });

  await uploadBytesWithProgress(
    `${gateway}/uploads/${session.sessionId}/bytes`,
    token,
    contentType,
    file,
    options,
  );

  const asset = await madJson<{assetId: string; contentType?: string}>(
    `${gateway}/uploads/complete`,
    {
      method: "POST",
      token,
      headers: {"content-type": "application/json"},
      body: JSON.stringify({sessionId: session.sessionId}),
    },
  );

  return {
    url: assetUrl(asset.assetId, visibility, gateway),
    // The legacy contract calls this a filename because the old backend keyed
    // deletion on one. MAD keys everything on the asset id, so that is the
    // handle, whatever the field is called.
    filename: asset.assetId,
    size: file.size,
    mimeType: asset.contentType ?? contentType,
    assetId: asset.assetId,
    originalFilename: file.name,
  };
}

/**
 * A public asset is read straight from MAD; a private one is read back through
 * 108heros's own media-proxy.
 *
 * That asymmetry is the point, not an inconsistency: the proxy is where room
 * membership is re-checked. Handing out MAD's own address for a private asset
 * would route around that check entirely, and it would look like it worked.
 */
function assetUrl(
  assetId: string,
  visibility: MediaVisibility,
  gateway: string,
): string {
  if (visibility === "public") {
    return `${madPublicUrl(gateway)}/assets/${assetId}/public-bytes`;
  }
  const apiBase = trimSlash(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
  return `${apiBase}/api/v4/media-proxy/${assetId}`;
}
