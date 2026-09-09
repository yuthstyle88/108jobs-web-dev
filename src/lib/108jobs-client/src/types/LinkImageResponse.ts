/**
 * What the image routes actually return.
 *
 * Mirrors `LinkImageResponse` in api-108heros-dev
 * (`crates/db/src/source/site_view/api.rs`). Every `link_*` handler --
 * user avatar and banner, category icon and banner, site icon and banner --
 * returns this one shape.
 *
 * It replaces `UploadImageResponse` (`{ images: { imageUrl, filename }[] }`),
 * which no backend route has ever returned. Because the old type declared a
 * field the server does not send, `res.data.images?.[0]?.imageUrl` type-checked
 * and then read `undefined` at runtime, so callers took neither their success
 * nor their failure branch and silently did nothing.
 */
export type LinkImageResponse = {
  url: string;
}
