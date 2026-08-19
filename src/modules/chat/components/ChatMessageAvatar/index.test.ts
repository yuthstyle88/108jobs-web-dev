import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {ChatMessageAvatar} from "@/modules/chat/components/ChatMessageAvatar";

describe("ChatMessageAvatar", () => {
    it("keeps an incoming avatar square, clipped, and cover-fitted", () => {
        const markup = renderToStaticMarkup(
            createElement(ChatMessageAvatar, {src: "/partner-avatar.jpg"}),
        );

        expect(markup).toContain("size-7");
        expect(markup).toContain("sm:size-8");
        expect(markup).toContain("shrink-0");
        expect(markup).toContain("overflow-hidden");
        expect(markup).toContain("rounded-full");
        expect(markup).toContain("object-cover");
    });
});
