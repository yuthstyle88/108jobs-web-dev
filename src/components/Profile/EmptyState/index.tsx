"use client";
import React from "react";
import Link from "next/link";
import {LucideIcon, Plus} from "lucide-react";
import {useLanguage} from "@/contexts/LanguageContext";
import {withLocalePrefix} from "@/utils/localeHref";

interface EmptyStateProps {
    icon: LucideIcon;
    message: string;
    /** Shown as a clickable "add" prompt instead of a flat message -- only pass
     * these on the profile's own owner, editing someone else's is not a thing. */
    addLabel?: string;
    href?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({icon: Icon, message, addLabel, href}) => {
    const {lang} = useLanguage();
    if (href && addLabel) {
        return (
            <Link
                href={withLocalePrefix(href, lang)}
                prefetch={false}
                className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors"
            >
                <Icon className="w-5 h-5 shrink-0"/>
                <span className="flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5"/>
                    {addLabel}
                </span>
            </Link>
        );
    }

    return (
        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-400">
            <Icon className="w-5 h-5 shrink-0"/>
            {message}
        </div>
    );
};

export default EmptyState;
