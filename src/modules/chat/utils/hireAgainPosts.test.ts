import {describe, expect, it} from "vitest";

import {toHireAgainPosts} from "./hireAgainPosts";

/**
 * What the picker is allowed to offer.
 *
 * The list endpoint returns the employer's posts including ones they deleted or
 * a moderator removed. Offering those would start an order against a job that
 * no longer exists -- and the server would refuse it after the employer had
 * already confirmed, which reads as "Hire again is broken".
 */
const item = (post: Record<string, unknown>) =>
    ({
        post: {id: 1, name: "A job", budget: 1000, deleted: false, removed: false, ...post},
    }) as never;

describe("the jobs Hire again may offer", () => {
    it("keeps id, name and budget", () => {
        expect(toHireAgainPosts([item({id: 1305940, name: "Record all core flows", budget: 3000})]))
            .toEqual([{id: 1305940, name: "Record all core flows", budget: 3000}]);
    });

    it("drops a deleted job", () => {
        expect(toHireAgainPosts([item({deleted: true})])).toEqual([]);
    });

    it("drops a removed job", () => {
        expect(toHireAgainPosts([item({removed: true})])).toEqual([]);
    });

    it("survives a response with no posts", () => {
        expect(toHireAgainPosts(undefined)).toEqual([]);
    });
});
