import {describe, expect, it} from "vitest";

import {parseAttachment} from "@/modules/chat/attachments/parseAttachment";

const envelope = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "file",
    url: "https://x.test/api/v4/media-proxy/asset-1",
    name: "Q3 quotation.pdf",
    mime: "application/pdf",
    caption: "here you go",
    ...extra,
  });

describe("parseAttachment", () => {
  it("reads the current envelope", () => {
    expect(parseAttachment(envelope({assetId: "asset-1"}))).toEqual({
      kind: "file",
      url: "https://x.test/api/v4/media-proxy/asset-1",
      name: "Q3 quotation.pdf",
      mime: "application/pdf",
      caption: "here you go",
      assetId: "asset-1",
    });
  });

  it("reads a legacy envelope with no asset id", () => {
    const parsed = parseAttachment(envelope());
    expect(parsed?.assetId).toBeUndefined();
    expect(parsed?.name).toBe("Q3 quotation.pdf");
  });

  it("accepts a delivery submission, which carries the same shape", () => {
    const parsed = parseAttachment(
      JSON.stringify({type: "submit-delivery", url: "https://x.test/d.zip", name: "d.zip"}),
    );
    expect(parsed?.kind).toBe("file");
    expect(parsed?.url).toBe("https://x.test/d.zip");
  });

  it("classifies by mime", () => {
    expect(parseAttachment(envelope({mime: "image/png"}))?.kind).toBe("image");
    expect(parseAttachment(envelope({mime: "video/mp4"}))?.kind).toBe("video");
  });

  it("falls back to the url for a name when the envelope has none", () => {
    const parsed = parseAttachment(
      JSON.stringify({type: "file", url: "https://x.test/files/holiday%20photo.png"}),
    );
    expect(parsed?.name).toBe("holiday photo.png");
    expect(parsed?.kind).toBe("image");
  });

  it("survives a url whose escape sequence is malformed", () => {
    const parsed = parseAttachment(JSON.stringify({type: "file", url: "https://x.test/a%ZZ.png"}));
    expect(parsed?.name).toBe("a%ZZ.png");
  });

  it("ignores plain text without trying to parse it", () => {
    expect(parseAttachment("just a normal message")).toBeNull();
    expect(parseAttachment("file:some-legacy-name.png")).toBeNull();
    expect(parseAttachment("")).toBeNull();
  });

  it("ignores malformed json rather than throwing", () => {
    expect(parseAttachment('{"type":"file",')).toBeNull();
    expect(parseAttachment("{")).toBeNull();
  });

  it("ignores other structured messages", () => {
    expect(parseAttachment(JSON.stringify({type: "proposed-quote", quote: {}}))).toBeNull();
    expect(parseAttachment(JSON.stringify({type: "review-submitted", rating: 5}))).toBeNull();
    expect(parseAttachment(JSON.stringify({type: "request-revision"}))).toBeNull();
  });

  it("rejects an envelope with no usable url", () => {
    expect(parseAttachment(JSON.stringify({type: "file", name: "x.pdf"}))).toBeNull();
    expect(parseAttachment(JSON.stringify({type: "file", url: "   "}))).toBeNull();
    expect(parseAttachment(JSON.stringify({type: "file", url: 42}))).toBeNull();
  });

  it("ignores non-strings and json that is not an object", () => {
    expect(parseAttachment(undefined)).toBeNull();
    expect(parseAttachment(null)).toBeNull();
    expect(parseAttachment(12)).toBeNull();
    expect(parseAttachment("[1,2,3]")).toBeNull();
  });

  it("drops blank optional fields instead of carrying empty strings", () => {
    const parsed = parseAttachment(envelope({caption: "", assetId: "  "}));
    expect(parsed?.caption).toBeUndefined();
    expect(parsed?.assetId).toBeUndefined();
  });
});
