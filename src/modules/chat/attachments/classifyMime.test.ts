import {describe, expect, it} from "vitest";

import {classifyMime} from "@/modules/chat/attachments/classifyMime";

describe("classifyMime", () => {
  it("routes images and videos to their own tab", () => {
    expect(classifyMime("image/png")).toBe("image");
    expect(classifyMime("image/svg+xml")).toBe("image");
    expect(classifyMime("video/mp4")).toBe("video");
    expect(classifyMime("video/quicktime")).toBe("video");
  });

  it("treats everything else as a file", () => {
    expect(classifyMime("application/pdf")).toBe("file");
    expect(classifyMime("audio/mpeg")).toBe("file");
    expect(classifyMime("text/plain")).toBe("file");
  });

  it("is case- and whitespace-insensitive, because servers are inconsistent", () => {
    expect(classifyMime("  IMAGE/PNG ")).toBe("image");
  });

  it("falls back to the extension for legacy attachments with no usable mime", () => {
    // /account/files URLs carry an extension and often no mime at all. MAD
    // proxy URLs are extension-less UUIDs, but always have a mime.
    expect(classifyMime(undefined, "holiday.JPG")).toBe("image");
    expect(classifyMime("", "clip.webm")).toBe("video");
    expect(classifyMime("application/octet-stream", "scan.png")).toBe("image");
    expect(classifyMime(undefined, "contract.pdf")).toBe("file");
  });

  it("reads the extension off a url with a query string", () => {
    expect(classifyMime(undefined, "https://x.test/a/b/photo.png?v=2#frag")).toBe("image");
  });

  it("does not let the extension override an explicit mime", () => {
    // A .png served as a pdf is a pdf; trusting the name would be a lie.
    expect(classifyMime("application/pdf", "invoice.png")).toBe("file");
  });

  it("is a file when there is nothing to go on", () => {
    expect(classifyMime()).toBe("file");
    expect(classifyMime(undefined, undefined)).toBe("file");
    expect(classifyMime(undefined, "no-extension")).toBe("file");
    expect(classifyMime(undefined, "trailing.")).toBe("file");
  });
});
