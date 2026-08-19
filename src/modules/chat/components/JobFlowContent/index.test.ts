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

const renderFlowContent = () => createElement("div", {"data-testid": "job-flow"}, "job flow");

describe("JobFlowContent", () => {
    it("shows the hiring prompt instead of the job flow when no job is linked", () => {
        const markup = renderToStaticMarkup(
            createElement(JobFlowContent, {renderFlowContent, jobId: undefined, lang: "en"}),
        );

        expect(markup).toContain("Not sure where to start?");
        expect(markup).not.toContain('data-testid="job-flow"');
    });

    it("shows job details and the workflow when a job is linked", () => {
        const markup = renderToStaticMarkup(
            createElement(JobFlowContent, {renderFlowContent, jobId: 731, lang: "en"}),
        );

        expect(markup).toContain('href="/en/job-board/731"');
        expect(markup).toContain('data-testid="job-flow"');
        expect(markup).not.toContain("Not sure where to start?");
    });
});
