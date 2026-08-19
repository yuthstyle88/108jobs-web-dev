import {describe, expect, it} from "vitest";

import config from "../tailwind.config";

describe("Tailwind content configuration", () => {
    it("scans module components for responsive avatar classes", () => {
        expect(config.content).toContain("./src/modules/**/*.{js,ts,jsx,tsx,mdx}");
    });
});
