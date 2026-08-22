import {afterEach, describe, expect, it, vi} from "vitest";

import {wrapClient} from "@/services/HttpService";

describe("WrappedApiClient cache invalidation", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("keeps a replacement request registered when the invalidated request settles first", async () => {
        const resolvers: Array<(value: {source: string}) => void> = [];

        class FakeApi {
            calls = 0;

            getUnreadSnapshot() {
                this.calls += 1;
                return new Promise<{source: string}>((resolve) => {
                    resolvers.push(resolve);
                });
            }
        }

        const rawClient = new FakeApi();
        const client = wrapClient(rawClient as never) as ReturnType<typeof wrapClient> & {
            clearCacheEntry: (method: string, args: unknown[]) => void;
        };

        const firstRequest = client.getUnreadSnapshot();
        client.clearCacheEntry("getUnreadSnapshot", []);
        const secondRequest = client.getUnreadSnapshot();

        await Promise.resolve();
        expect(rawClient.calls).toBe(2);

        resolvers[0]({source: "old-user"});
        await expect(firstRequest).resolves.toMatchObject({
            state: "success",
            data: {source: "old-user"},
        });

        const thirdRequest = client.getUnreadSnapshot();
        expect(rawClient.calls).toBe(2);

        resolvers[1]({source: "new-user"});
        await expect(secondRequest).resolves.toMatchObject({
            state: "success",
            data: {source: "new-user"},
        });
        await expect(thirdRequest).resolves.toMatchObject({
            state: "success",
            data: {source: "new-user"},
        });
    });

    it("does not let an invalidated late response overwrite the replacement cache", async () => {
        vi.stubEnv("NODE_ENV", "production");
        const resolvers: Array<(value: {source: string}) => void> = [];

        class FakeApi {
            calls = 0;

            getUnreadSnapshot() {
                this.calls += 1;
                return new Promise<{source: string}>((resolve) => {
                    resolvers.push(resolve);
                });
            }
        }

        const rawClient = new FakeApi();
        const client = wrapClient(rawClient as never) as ReturnType<typeof wrapClient> & {
            clearCacheEntry: (method: string, args: unknown[]) => void;
        };

        const oldRequest = client.getUnreadSnapshot();
        client.clearCacheEntry("getUnreadSnapshot", []);
        const replacementRequest = client.getUnreadSnapshot();

        await Promise.resolve();
        resolvers[1]({source: "new-user"});
        await replacementRequest;
        resolvers[0]({source: "old-user"});
        await oldRequest;

        await expect(client.getUnreadSnapshot()).resolves.toMatchObject({
            state: "success",
            data: {source: "new-user"},
        });
        expect(rawClient.calls).toBe(2);
    });
});
