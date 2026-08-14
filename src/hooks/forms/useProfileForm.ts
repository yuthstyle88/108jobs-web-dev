'use client';

import useNotification from '@/hooks/ui/useNotification';
import { useHttpPost } from '@/hooks/api/http/useHttpPost';
import { REQUEST_STATE } from '@/services/HttpService';
import { Person, PortfolioPic, SaveUserSettings, WorkSample } from '108jobs-client';
import { useState } from 'react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { resolveApiErrorMessage } from '@/utils/errorMessage';

interface FormValues {
    displayName: string;
    username: string;
    bio: string;
    skills: string;
    contacts: string;
    workSamples: WorkSample[];
    portfolioPics: PortfolioPic[];
}

export const useProfileForm = (
    person: Person | undefined,
    setSelectedImage: (imageUrl: string) => void,
    portfolioItems?: PortfolioPic[],
    workSamples?: WorkSample[],
) => {
    const { t } = useTranslation();
    const { successMessage, errorMessage } = useNotification();
    const { execute: saveUserSettings, isMutating: isSubmitting } = useHttpPost('saveUserSettings');

    const FormSchema = z.object({
        displayName: z
            .string()
            .min(1, t('profileInfo.accountInfo') || 'Display name is required')
            .refine((value) => value.trim().length > 0, {
                message: t('profileInfo.invalidDisplayName') || 'Display name cannot be empty',
            }),
        bio: z.string().optional(),
        skills: z.string().optional(),
        contacts: z.string().optional(),
    });

    const [form, setForm] = useState<FormValues>({
        username: person?.name || '',
        displayName: person?.displayName || '',
        bio: person?.bio || '',
        skills: person?.skills || '',
        contacts: person?.contacts || '',
        workSamples: person?.workSamples ?? [],
        portfolioPics: person?.portfolioPics ?? [],
    });
    const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

    // Track which `person` the form was last synced from so we can adjust the
    // form during render when `person` changes, instead of doing it in an
    // effect (which would cause an extra render pass).
    const [syncedPerson, setSyncedPerson] = useState(person);
    if (person && person !== syncedPerson) {
        setSyncedPerson(person);
        const newForm = {
            username: person.name || '',
            displayName: person.displayName || '',
            bio: person.bio || '',
            skills: person.skills || '',
            contacts: person.contacts || '',
            workSamples: person.workSamples ?? [],
            portfolioPics: person.portfolioPics ?? [],
        };
        if (JSON.stringify(newForm) !== JSON.stringify(form)) {
            setForm(newForm);
        }
        setSelectedImage(person.avatar || '');
    }

    const validateField = async <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
        const tempForm = { ...form, [key]: value };
        const result = await FormSchema.safeParseAsync(tempForm);
        if (!result.success) {
            const error = result.error.issues.find((issue) => issue.path[0] === key);
            setErrors((prev) => ({
                ...prev,
                [key]: error?.message || '',
            }));
        } else {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[key];
                return newErrors;
            });
        }
    };

    const onSubmit = async () => {
        setErrors({});
        const previousForm = form;

        const result = await FormSchema.safeParseAsync(form);
        if (!result.success) {
            const newErrors: Partial<Record<keyof FormValues, string>> = {};
            result.error.issues.forEach((issue) => {
                newErrors[issue.path[0] as keyof FormValues] = issue.message;
            });
            setErrors(newErrors);
            return false;
        }

        try {
            const payload: SaveUserSettings = {
                portfolioPics: portfolioItems ?? form.portfolioPics,
                workSamples: workSamples ?? form.workSamples,
                displayName: form.displayName,
                bio: form.bio,
                skills: form.skills,
                contacts: form.contacts,
            };

            const response = await saveUserSettings(payload);

            if (response.state === REQUEST_STATE.FAILED) {
                // Previously always showed the same generic title regardless
                // of what the server actually said.
                const messageError = resolveApiErrorMessage(response.err, t, {fallback: t('error.title')});
                errorMessage(null, null, messageError);
                setForm(previousForm);
                return false;
            }

            successMessage(null, null, t('profile.update') ?? 'Profile updated successfully!');
            return true;
        } catch (error) {
            errorMessage(null, null, t('error.title') ?? 'Submission failed!');
            setForm(previousForm);
            return false;
        }
    };

    const resetForm = () => {
        if (window.confirm(t('profileInfo.confirmReset'))) {
            setForm({
                username: person?.name || '',
                displayName: person?.displayName || '',
                bio: person?.bio || '',
                skills: person?.skills || '',
                contacts: person?.contacts || '',
                workSamples: person?.workSamples ?? [],
                portfolioPics: person?.portfolioPics ?? [],
            });
            setErrors({});
            setSelectedImage(person?.avatar || '');
        }
    };

    return {
        form,
        setForm,
        errors,
        isSubmitting,
        onSubmit,
        validateField,
        resetForm,
    };
};