import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {ChatMessageAvatar} from "@/modules/chat/components/ChatMessageAvatar";

describe("ChatMessageAvatar", () => {
    it("keeps an incoming avatar square, clipped, and cover-fitted", () => {
        const markup = renderToStaticMarkup(
            createElement(ChatMessageAvatar, {src: "/partner-avatar.jpg"}),
        );
        const wrapper = markup.match(/<span\b[^>]*>/)?.[0] ?? "";
        const image = markup.match(/<img\b[^>]*>/)?.[0] ?? "";

        expect(wrapper).toContain("size-7");
        expect(wrapper).toContain("sm:size-8");
        expect(wrapper).toContain("shrink-0");
        expect(wrapper).toContain("overflow-hidden");
        expect(wrapper).toContain("rounded-full");
        expect(image).toContain("object-cover");
    });
});
