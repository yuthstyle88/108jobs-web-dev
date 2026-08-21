import {describe, expect, it} from "vitest";

import {attachmentSrc} from "./attachmentSrc";

describe("attachmentSrc", () => {
  it("returns the same-origin media route when assetId is present", () => {
    const src = attachmentSrc({
      url: "https://backend.test/api/v4/media-proxy/9f1c",
      assetId: "9f1c-asset",
    });

    expect(src).toBe("/api/media/9f1c-asset");
  });

  it("falls back to the stored url for a legacy attachment with no assetId", () => {
    const src = attachmentSrc({
      url: "https://backend.test/api/v4/media-proxy/legacy",
    });

    expect(src).toBe("https://backend.test/api/v4/media-proxy/legacy");
  });

  it("falls back to the stored url when assetId is an empty string", () => {
    const src = attachmentSrc({
      url: "https://backend.test/api/v4/media-proxy/legacy",
      assetId: "",
    });

    expect(src).toBe("https://backend.test/api/v4/media-proxy/legacy");
  });
});
