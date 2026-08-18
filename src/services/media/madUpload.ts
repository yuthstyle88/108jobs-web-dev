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

  const bytes = await fetch(`${gateway}/uploads/${session.sessionId}/bytes`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": contentType,
    },
    body: file,
  });
  if (!bytes.ok) {
    throw new Error(`MAD byte upload failed: ${bytes.status}`);
  }

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
 * 108jobs's own media-proxy.
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
