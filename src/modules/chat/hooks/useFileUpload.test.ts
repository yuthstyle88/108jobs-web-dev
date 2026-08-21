// @vitest-environment jsdom
/**
 * Regression coverage for "the composer's upload thumbnail never appears".
 *
 * This mounts the REAL useFileUpload hook (only the network boundary --
 * madUpload's uploadToMad/madGatewayUrl, and useHttpPost, which the legacy
 * path would otherwise need a live SWR/context stack for -- is mocked) next
 * to a DOM structure that mirrors ChatRoomView's own attachment-preview
 * gating (`{attachmentPreview && (...)}`, `<img src={attachmentPreview.url}>`
 * inside it), and asserts on the actual rendered DOM, not just hook state:
 * an object URL existing in React state is not the same claim as an <img>
 * actually carrying it in the committed DOM.
 *
 * uploadToMad is driven by a manually-resolved ("deferred") promise so the
 * test can inspect the DOM in the gap between "upload started" and "upload
 * finished" -- exactly the window the composer's thumbnail is supposed to
 * be visible for -- rather than only before/after a call that in real usage
 * resolves synchronously and could hide a timing bug either way.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/api/http/useHttpPost", () => ({
  // MAD's success path never calls either `execute` (upload goes through
  // uploadToMad, mocked separately below); this only matters for
  // handleRemoveSelectedFile's deleteFile(storageKey) call once a file has
  // already finished uploading, which requires a REQUEST_STATE.SUCCESS
  // shape to proceed past its own `res.state !== SUCCESS` check.
  useHttpPost: () => ({ execute: vi.fn(async () => ({ state: "success", data: {} })) }),
}));

vi.mock("@/services/media/madUpload", () => ({
  madGatewayUrl: vi.fn(() => "https://mad.test"),
  uploadToMad: vi.fn(),
}));

// Imports below must come after vi.mock so they pick up the mocked module.
import { uploadToMad } from "@/services/media/madUpload";
import { useFileUpload } from "@/modules/chat/hooks/useFileUpload";

/** Mirrors the resolved shape uploadToMad's real implementation returns. */
type FakeAsset = {
  url: string;
  filename: string;
  size: number;
  mimeType?: string;
  assetId?: string;
  originalFilename?: string;
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Faithful mirror of ChatRoomView's composer attachment block: gated on
 * `attachmentPreview` alone (not `selectedFile`/`isUploading`), image vs.
 * file-chip branch on `attachmentPreview.kind`, progress overlay gated on
 * `isUploading` *inside* that block. If ChatRoomView's real JSX ever drifts
 * from this shape, that is itself worth noticing -- this is deliberately a
 * copy, not an import, because the real block is inline JSX in a giant
 * component this test does not otherwise stand up.
 */
function ComposerProbe({
  onHook,
}: {
  onHook: (h: ReturnType<typeof useFileUpload>) => void;
}) {
  const hook = useFileUpload({ setError: () => {}, t: (k: string) => k });
  onHook(hook);
  const { attachmentPreview, isUploading } = hook;

  if (!attachmentPreview) return null;

  return React.createElement(
    "div",
    { "data-testid": "attachment-preview" },
    attachmentPreview.kind === "file"
      ? React.createElement("span", { "data-testid": "attachment-chip" })
      : React.createElement(
          "div",
          { "data-testid": "attachment-thumb-box" },
          attachmentPreview.kind === "image"
            ? React.createElement("img", {
                "data-testid": "attachment-img",
                src: attachmentPreview.url,
                alt: attachmentPreview.name,
              })
            : React.createElement("video", {
                "data-testid": "attachment-video",
                src: attachmentPreview.url,
                muted: true,
              }),
          isUploading
            ? React.createElement("div", { "data-testid": "upload-progress" })
            : null
        )
  );
}

describe("useFileUpload composer thumbnail (never-appears regression)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestHook: ReturnType<typeof useFileUpload> | null;
  // `any`-typed spy handle: vi.spyOn's precise generic signature (tied to
  // URL.revokeObjectURL's overloads) is more trouble than it is worth for a
  // test-local handle only ever used via mockImplementation/
  // toHaveBeenCalledWith. createObjectURL is likewise stubbed below but its
  // spy handle is never read back, so it is not kept as a variable at all.
  let revokeObjectURLSpy: any;
  let blobCounter: number;

  beforeEach(() => {
    blobCounter = 0;
    if (typeof URL.createObjectURL !== "function") {
      (URL as unknown as { createObjectURL: unknown }).createObjectURL = () => "";
    }
    if (typeof URL.revokeObjectURL !== "function") {
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = () => {};
    }
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:mock-${++blobCounter}`);
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    latestHook = null;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  function mount() {
    act(() => {
      root = createRoot(container);
      root.render(
        React.createElement(ComposerProbe, {
          onHook: (h) => {
            latestHook = h;
          },
        })
      );
    });
  }

  function fakeChangeEvent(file: File) {
    return { target: { files: [file], value: "" } } as unknown as Event;
  }

  it("shows the picked image immediately and keeps showing it through and after the upload -- does not clear on success", async () => {
    const upload = deferred<FakeAsset>();
    vi.mocked(uploadToMad).mockReturnValue(upload.promise as unknown as ReturnType<typeof uploadToMad>);

    mount();
    expect(container.querySelector('[data-testid="attachment-preview"]')).toBeNull();

    const file = new File(["fake-bytes"], "photo.png", { type: "image/png" });

    // Fire the pick but do NOT await the upload -- this call only runs
    // synchronously up to `await uploadToMad(...)`, which is blocked on
    // `upload.promise` until this test resolves it below. Every setState
    // call before that first await (replaceAttachmentPreview, setIsUploading,
    // setUploadProgress) happens inside this one synchronous act(), matching
    // real browser timing where the MAD calls are genuine network I/O and
    // React gets a full paint before they resolve.
    let uploadCall!: Promise<unknown>;
    act(() => {
      uploadCall = latestHook!.handleFileUpload(fakeChangeEvent(file));
    });

    // --- Mid-upload: this is the state a real user sees while MAD's three
    // calls are in flight. If the thumbnail is ever going to be visible,
    // it has to be visible here. ---
    expect(latestHook!.attachmentPreview).not.toBeNull();
    expect(latestHook!.attachmentPreview?.kind).toBe("image");
    expect(latestHook!.isUploading).toBe(true);

    const img = container.querySelector<HTMLImageElement>('[data-testid="attachment-img"]');
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(latestHook!.attachmentPreview!.url);
    expect(container.querySelector('[data-testid="upload-progress"]')).not.toBeNull();

    const previewUrlDuringUpload = latestHook!.attachmentPreview!.url;

    // --- Upload completes. ---
    await act(async () => {
      upload.resolve({
        url: "https://mad.test/assets/abc/private-bytes",
        filename: "abc",
        size: file.size,
        mimeType: "image/png",
        assetId: "abc",
        originalFilename: "photo.png",
      });
      await uploadCall;
    });

    // The preview must survive success -- it is the ready-to-send
    // thumbnail now, not just the upload-in-progress one. Clearing it here
    // is exactly the bug under test: the composer's own object URL gets
    // revoked (and the <img> loses its src) the moment the upload succeeds,
    // which in a real browser leaves nothing to ever have been visible for
    // more than the length of the network round trip.
    expect(latestHook!.attachmentPreview).not.toBeNull();
    expect(latestHook!.attachmentPreview!.url).toBe(previewUrlDuringUpload);
    expect(latestHook!.isUploading).toBe(false);
    expect(latestHook!.selectedFile).not.toBeNull();
    expect(latestHook!.selectedFile?.assetId).toBe("abc");

    const imgAfter = container.querySelector<HTMLImageElement>('[data-testid="attachment-img"]');
    expect(imgAfter).not.toBeNull();
    expect(imgAfter!.getAttribute("src")).toBe(previewUrlDuringUpload);

    expect(revokeObjectURLSpy).not.toHaveBeenCalledWith(previewUrlDuringUpload);
  });

  it("revokes the object URL and clears the preview when the file is removed after upload completes", async () => {
    const upload = deferred<FakeAsset>();
    vi.mocked(uploadToMad).mockReturnValue(upload.promise as unknown as ReturnType<typeof uploadToMad>);
    mount();

    const file = new File(["fake-bytes"], "photo.png", { type: "image/png" });
    let uploadCall!: Promise<unknown>;
    act(() => {
      uploadCall = latestHook!.handleFileUpload(fakeChangeEvent(file));
    });
    await act(async () => {
      upload.resolve({
        url: "https://mad.test/assets/abc/private-bytes",
        filename: "abc",
        size: file.size,
        assetId: "abc",
      });
      await uploadCall;
    });

    const url = latestHook!.attachmentPreview!.url;
    expect(container.querySelector('[data-testid="attachment-preview"]')).not.toBeNull();

    await act(async () => {
      await latestHook!.handleRemoveSelectedFile();
    });

    expect(latestHook!.attachmentPreview).toBeNull();
    expect(container.querySelector('[data-testid="attachment-preview"]')).toBeNull();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url);
  });

  it("revokes the previous preview's URL when a second pick replaces the first mid-upload", async () => {
    const firstUpload = deferred<FakeAsset>();
    vi.mocked(uploadToMad).mockReturnValueOnce(firstUpload.promise as unknown as ReturnType<typeof uploadToMad>);
    mount();

    const fileA = new File(["a"], "a.png", { type: "image/png" });
    act(() => {
      void latestHook!.handleFileUpload(fakeChangeEvent(fileA));
    });
    const urlA = latestHook!.attachmentPreview!.url;
    expect(urlA).toBeTruthy();

    const secondUpload = deferred<FakeAsset>();
    vi.mocked(uploadToMad).mockReturnValueOnce(secondUpload.promise as unknown as ReturnType<typeof uploadToMad>);
    const fileB = new File(["b"], "b.png", { type: "image/png" });
    act(() => {
      void latestHook!.handleFileUpload(fakeChangeEvent(fileB));
    });

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(urlA);
    expect(latestHook!.attachmentPreview!.url).not.toBe(urlA);
    expect(latestHook!.attachmentPreview!.name).toBe("b.png");

    // The superseded first upload finishing later must not resurrect
    // anything (uploadGenerationRef guard).
    await act(async () => {
      firstUpload.resolve({ url: "x", filename: "a", size: 1, assetId: "a" });
      await Promise.resolve();
    });
    expect(latestHook!.attachmentPreview!.name).toBe("b.png");
  });

  it("revokes the live preview's URL on unmount", () => {
    const upload = deferred<FakeAsset>();
    vi.mocked(uploadToMad).mockReturnValue(upload.promise as unknown as ReturnType<typeof uploadToMad>);
    mount();

    const file = new File(["a"], "a.png", { type: "image/png" });
    act(() => {
      void latestHook!.handleFileUpload(fakeChangeEvent(file));
    });
    const url = latestHook!.attachmentPreview!.url;

    act(() => {
      root.unmount();
    });

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url);
  });
});
