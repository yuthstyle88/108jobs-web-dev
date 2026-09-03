"use client";

import * as Switch from "@radix-ui/react-switch";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { REQUEST_STATE } from "@/services/HttpService";
import { useUserStore } from "@/store/useUserStore";
import useNotification from "@/hooks/ui/useNotification";
import { useHttpPost } from "@/hooks/api/http/useHttpPost";
import { SaveUserSettings } from "@108-plaza/jh-client";

const JobAvailable = () => {
    const { person, setPerson } = useUserStore();
    const { successMessage, errorMessage } = useNotification();
    const { execute: saveUserSettings, isMutating } = useHttpPost("saveUserSettings");
    const { t } = useTranslation();

    const [checked, setChecked] = useState(Boolean(person?.available));

    useEffect(() => {
        setChecked(Boolean(person?.available));
    }, [person?.available]);

    const handleToggle = async (value: boolean) => {
        if (!person) return;

        const prevPerson = { ...person };
        const prevAvailable = person.available;

        // Optimistic UI update
        setChecked(value);
        setPerson({ ...prevPerson, available: value });

        try {
            const payload: SaveUserSettings = {
                workSamples: person.workSamples ?? [],
                displayName: person.displayName ?? "",
                bio: person.bio ?? "",
                skills: person.skills ?? "",
                contacts: person.contacts ?? "",
                portfolioPics: person.portfolioPics ?? [],
                available: value,
            };

            const response = await saveUserSettings(payload);

            if (response.state === REQUEST_STATE.SUCCESS) {
                successMessage(null, null, t(value ? "profileInfo.updateAvailable" : "profileInfo.updateNotAvailable"));
            } else {
                throw new Error("Save failed");
            }
        } catch {
            // Revert on failure
            setChecked(prevAvailable);
            setPerson(prevPerson);
            errorMessage(null, null, t("profileInfo.updateAvailableFail"));
        }
    };

    return (
        <div className="bg-white rounded-md shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 p-5">
                <h2 className="text-lg font-medium text-gray-800">{t("global.jobVailable")}</h2>
                <p className="text-sm text-gray-500">{t("global.toggle")}</p>
            </div>

            <div className="p-6">
                <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-gray-700">{t("global.acptJob")}</span>
                    <Switch.Root
                        checked={checked}
                        onCheckedChange={handleToggle}
                        disabled={isMutating}
                        aria-label={t("global.acptJob")}
                        className={`relative w-[42px] h-[24px] rounded-full transition-colors bg-gray-300 data-[state=checked]:bg-primary ${
                            isMutating ? "opacity-50 pointer-events-none" : "cursor-pointer"
                        }`}
                    >
                        <Switch.Thumb
                            className={`block w-[18px] h-[18px] bg-white rounded-full shadow-md transition-transform duration-200 translate-x-[3px] data-[state=checked]:translate-x-[21px]`}
                        />
                    </Switch.Root>
                </div>
            </div>
        </div>
    );
};

export default JobAvailable;