import {describe, expect, it} from "vitest";

import {uploadKindForMime} from "@/modules/chat/hooks/uploadKind";

describe("uploadKindForMime", () => {
  it("declares images as image media", () => {
    expect(uploadKindForMime("image/png")).toBe("image");
    expect(uploadKindForMime("image/webp")).toBe("image");
  });

  it("declares video as file media, so MAD serves it verbatim", () => {
    // MAD's `File` kind is documented "stored and served verbatim, never
    // processed/transcoded", which is what keeps the proxy's
    // /internal/assets/{id}/bytes returning the original. Declaring `video`
    // would enrol a chat attachment in a transcoding pipeline instead.
    expect(uploadKindForMime("video/mp4")).toBe("file");
    expect(uploadKindForMime("video/quicktime")).toBe("file");
  });

  it("declares documents as file media", () => {
    expect(uploadKindForMime("application/pdf")).toBe("file");
    expect(uploadKindForMime("application/zip")).toBe("file");
    expect(uploadKindForMime("audio/mpeg")).toBe("file");
  });

  it("uses the filename when the browser reported no type", () => {
    expect(uploadKindForMime(undefined, "holiday.png")).toBe("image");
    expect(uploadKindForMime("application/octet-stream", "scan.JPEG")).toBe("image");
    expect(uploadKindForMime("", "notes.txt")).toBe("file");
  });

  it("is file when there is nothing to go on", () => {
    expect(uploadKindForMime()).toBe("file");
  });
});
