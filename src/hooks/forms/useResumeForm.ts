'use client';

import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Person, SaveUserSettings} from '@108-plaza/jh-client';
import {useFileUpload} from '@/modules/chat/hooks/useFileUpload';
import {useHttpPost} from '@/hooks/api/http/useHttpPost';
import {REQUEST_STATE} from '@/services/HttpService';
import useNotification from '@/hooks/ui/useNotification';

type FileEvent = React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>;

export interface UseResumeFormProps {
    person?: Person;
    setPerson: (person: Person | null) => void;
}

export const useResumeForm = ({person, setPerson}: UseResumeFormProps) => {
    const {t} = useTranslation();
    const {successMessage} = useNotification();
    const {execute: saveUserSettings, isMutating: isSubmitting} = useHttpPost('saveUserSettings');

    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const {handleFileUpload} = useFileUpload({
        setError: setUploadError,
        t,
        visibility: 'public',
        kind: 'file',
    });

    const handleSelectFile = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
        async (e: FileEvent): Promise<void> => {
            const file =
                (e as React.ChangeEvent<HTMLInputElement>).target?.files?.[0] ||
                (e as React.DragEvent<HTMLDivElement>).dataTransfer?.files?.[0];
            if (!file || !person) return;

            const uploaded = await handleFileUpload(e as unknown as Event);
            if (!uploaded) {
                setUploadError(t('profileInfo.resumeUploadFailed') || 'Resume upload failed');
                return;
            }

            const payload: SaveUserSettings = {
                displayName: person.displayName ?? '',
                bio: person.bio ?? '',
                skills: person.skills ?? '',
                contacts: person.contacts ?? '',
                // saveUserSettings fully replaces portfolioPics/workSamples from whatever
                // the request contains (no partial update on the backend), so they must be
                // resent on every save or they get silently wiped. See useProfileForm.ts /
                // useWorkSamplesForm.ts for the same pattern.
                workSamples: person.workSamples ?? [],
                portfolioPics: person.portfolioPics ?? [],
                resumeUrl: uploaded.fileUrl,
                resumeFileName: file.name,
            };

            const response = await saveUserSettings(payload);
            if (response.state === REQUEST_STATE.FAILED) {
                setUploadError(t('error.title') || 'Failed to save resume');
                return;
            }

            setPerson({...person, resumeUrl: uploaded.fileUrl, resumeFileName: file.name});
            successMessage(null, null, t('profileInfo.resumeUpdated') ?? 'Resume updated!');
        },
        [handleFileUpload, person, saveUserSettings, setPerson, successMessage, t],
    );

    return {
        fileInputRef,
        handleSelectFile,
        handleFileChange,
        uploadError,
        isSubmitting,
    };
};
