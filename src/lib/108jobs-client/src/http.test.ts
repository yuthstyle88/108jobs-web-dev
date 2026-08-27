import { describe, expect, it } from "vitest";
import { Api108Jobs } from "./http";

describe("Api108Jobs identity-platform methods", () => {
  it("exposes loginWithIdentityPlatform and registerWithIdentityPlatform, and no longer exposes login", () => {
    const client = new Api108Jobs("http://localhost:8536");
    expect(typeof client.loginWithIdentityPlatform).toBe("function");
    expect(typeof client.registerWithIdentityPlatform).toBe("function");
    expect((client as unknown as Record<string, unknown>).login).toBeUndefined();
  });

  it("exposes refreshWithIdentityPlatform", () => {
    const client = new Api108Jobs("http://localhost:8536");
    expect(typeof client.refreshWithIdentityPlatform).toBe("function");
  });
});

// Every image route on the backend stores the upload through
// `store_multipart_file`, which skips any part not named `file` or `image` and
// then answers `400 invalidFile` because it stored nothing. The client used to
// name the part `images[]`, so all six image routes failed and only
// `/account/files` -- which takes the `file` branch -- ever worked. Asserting
// the field name is the only thing that catches this from here: the request is
// well-formed, the status is a plain 400, and nothing throws until a user
// tries it. See 108heros-web#109.
describe("Api108Jobs multipart uploads", () => {
  const uploadFieldNames = async (
    call: (client: Api108Jobs) => Promise<unknown>,
  ): Promise<string[]> => {
    let fields: string[] = [];
    const fetchFunction = (async (_url: unknown, init?: RequestInit) => {
      fields = [...(init?.body as unknown as FormData).keys()];
      return new Response(JSON.stringify({ url: "https://example.test/a.jpg" }), {
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = new Api108Jobs("http://localhost:8536", { fetchFunction });
    await call(client);
    return fields;
  };

  const image = () => new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" });

  it.each([
    ["uploadUserAvatar", (c: Api108Jobs) => c.uploadUserAvatar({ image: image() })],
    ["uploadUserBanner", (c: Api108Jobs) => c.uploadUserBanner({ image: image() })],
    ["uploadSiteIcon", (c: Api108Jobs) => c.uploadSiteIcon({ image: image() })],
    ["uploadSiteBanner", (c: Api108Jobs) => c.uploadSiteBanner({ image: image() })],
    ["uploadCategoryIcon", (c: Api108Jobs) => c.uploadCategoryIcon({ id: 1 }, { image: image() })],
    ["uploadCategoryBanner", (c: Api108Jobs) => c.uploadCategoryBanner({ id: 1 }, { image: image() })],
  ])("%s sends the part as `image`, a name the backend accepts", async (_name, call) => {
    expect(await uploadFieldNames(call)).toEqual(["image"]);
  });

  it("uploadFile keeps the `file` part name the file route already accepted", async () => {
    const fields = await uploadFieldNames((c) => c.uploadFile({ image: image() }));
    expect(fields).toEqual(["file"]);
  });
});
