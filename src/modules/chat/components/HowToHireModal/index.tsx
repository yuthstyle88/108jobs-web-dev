"use client";

import React, {useEffect, useRef} from "react";
import {Lightbulb, X} from "lucide-react";

const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export type HowToHireCopy = {
    title: string;
    closeLabel: string;
    dismissLabel: string;
    steps: Array<{
        title: string;
        items: string[];
    }>;
    hintTitle: string;
    hint: string;
};

type HowToHireModalProps = {
    isOpen: boolean;
    onClose: () => void;
    copy: HowToHireCopy;
};

export const HowToHireModal: React.FC<HowToHireModalProps> = ({isOpen, onClose, copy}) => {
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
                return;
            }
            if (event.key !== "Tab") return;

            const dialog = dialogRef.current;
            if (!dialog) return;

            const focusable = getFocusable(dialog);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            const outsideDialog = !active || !dialog.contains(active);
            const shouldWrap = event.shiftKey
                ? outsideDialog || active === first
                : outsideDialog || active === last;

            if (shouldWrap) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-3 sm:p-6"
            onClick={onClose}
        >
            <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="how-to-hire-title"
                className="w-full max-w-[500px] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-6"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="relative mb-7 flex items-center justify-center">
                    <h2 id="how-to-hire-title" className="text-base font-semibold text-slate-900 sm:text-lg">
                        {copy.title}
                    </h2>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label={copy.closeLabel}
                        className="absolute right-0 inline-flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <X className="size-5" aria-hidden="true"/>
                    </button>
                </header>

                <ol className="space-y-6">
                    {copy.steps.map((step, index) => (
                        <li key={step.title} className="flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600"
                            >
                                {index + 1}
                            </span>
                            <div className="min-w-0 pt-0.5">
                                <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
                                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-5 text-slate-600">
                                    {step.items.map((item) => <li key={item}>{item}</li>)}
                                </ul>
                            </div>
                        </li>
                    ))}
                </ol>

                <aside className="mt-7 rounded-xl bg-slate-100 px-4 py-3.5 text-sm leading-6 text-slate-600">
                    <h3 className="flex items-center gap-2 font-semibold text-slate-700">
                        <Lightbulb className="size-4" aria-hidden="true"/>
                        {copy.hintTitle}
                    </h3>
                    <p className="mt-1.5">{copy.hint}</p>
                </aside>

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-7 w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                    {copy.dismissLabel}
                </button>
            </section>
        </div>
    );
};
