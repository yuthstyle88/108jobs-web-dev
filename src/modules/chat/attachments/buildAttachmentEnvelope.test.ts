import {describe, expect, it} from "vitest";

import {buildAttachmentEnvelope} from "@/modules/chat/attachments/buildAttachmentEnvelope";
import {parseAttachment} from "@/modules/chat/attachments/parseAttachment";

describe("buildAttachmentEnvelope", () => {
  it("writes the current contract", () => {
    const json = buildAttachmentEnvelope({
      url: "https://x.test/api/v4/media-proxy/asset-1",
      name: "Q3 quotation.pdf",
      mime: "application/pdf",
      caption: "here you go",
      assetId: "asset-1",
    });

    expect(JSON.parse(json)).toEqual({
      type: "file",
      url: "https://x.test/api/v4/media-proxy/asset-1",
      name: "Q3 quotation.pdf",
      mime: "application/pdf",
      caption: "here you go",
      assetId: "asset-1",
    });
  });

  it("omits what it does not have rather than sending nulls", () => {
    const json = buildAttachmentEnvelope({url: "https://x.test/a.pdf", name: "a.pdf"});
    expect(JSON.parse(json)).toEqual({type: "file", url: "https://x.test/a.pdf", name: "a.pdf"});
  });

  it("keeps the user's filename, never the storage handle", () => {
    // uploadToMad returns the asset id as `filename` because MAD has no
    // filename concept at all -- this envelope is the only place the name the
    // user actually chose survives.
    const json = buildAttachmentEnvelope({
      url: "https://x.test/api/v4/media-proxy/9f1c",
      name: "Design brief.docx",
      assetId: "9f1c",
    });
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("Design brief.docx");
    expect(parsed.assetId).toBe("9f1c");
  });

  it("can write a delivery submission", () => {
    const json = buildAttachmentEnvelope({
      type: "submit-delivery",
      url: "https://x.test/d.zip",
      name: "d.zip",
    });
    expect(JSON.parse(json).type).toBe("submit-delivery");
  });

  it("round-trips through the parser", () => {
    const json = buildAttachmentEnvelope({
      url: "https://x.test/clip.mp4",
      name: "clip.mp4",
      mime: "video/mp4",
      assetId: "a-2",
    });
    expect(parseAttachment(json)).toEqual({
      kind: "video",
      url: "https://x.test/clip.mp4",
      name: "clip.mp4",
      mime: "video/mp4",
      caption: undefined,
      assetId: "a-2",
    });
  });
});
