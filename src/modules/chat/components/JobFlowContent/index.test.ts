import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import {JobFlowContent} from "@/modules/chat/components/JobFlowContent";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => ({
            "profileChat.howToHire.promptTitle": "Not sure where to start?",
            "profileChat.howToHire.promptSubtitle": "Don't worry, here's a quick guide.",
            "profileChat.howToHire.open": "How to hire",
            "profileChat.jobDetails": "Job Details",
        }[key] ?? key),
    }),
}));

describe("JobFlowContent", () => {
    it("shows the hiring prompt without invoking the workflow when no job is linked", () => {
        const renderFlowContent = vi.fn(() =>
            createElement("button", {type: "button", "data-testid": "start-workflow"}, "Start workflow"),
        );
        const markup = renderToStaticMarkup(
            createElement(JobFlowContent, {renderFlowContent, jobId: undefined, lang: "en"}),
        );

        expect(renderFlowContent).not.toHaveBeenCalled();
        expect(markup).toContain("Not sure where to start?");
        expect(markup).not.toContain('data-testid="start-workflow"');
    });

    it("keeps the workflow action alongside the localized Job Details link when a job is linked", () => {
        const renderFlowContent = vi.fn(() =>
            createElement("button", {type: "button", "data-testid": "start-workflow"}, "Start workflow"),
        );
        const markup = renderToStaticMarkup(
            createElement(JobFlowContent, {renderFlowContent, jobId: 731, lang: "en"}),
        );

        expect(renderFlowContent).toHaveBeenCalledTimes(1);
        expect(markup).toContain('href="/en/job-board/731"');
        expect(markup).toContain('data-testid="start-workflow"');
        expect(markup).toContain("Start workflow");
        expect(markup).not.toContain("Not sure where to start?");
    });
});
