'use client';

import useNotification from '@/hooks/ui/useNotification';
import { useHttpPost } from '@/hooks/api/http/useHttpPost';
import { REQUEST_STATE } from '@/services/HttpService';
import { Person, PortfolioPic, SaveUserSettings, WorkSample } from '108heros-client';
import { useState } from 'react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import {isEqual} from "lodash";

interface FormValues {
    newSample: { title: string; sampleUrl: string; description: string };
    displayName: string;
    bio: string;
    skills: string;
    contacts: string;
    workSamples: WorkSample[];
    portfolioPics: PortfolioPic[];
}

export interface WorkSamplesFormProps {
    person?: Person;
    setPerson: (person: Person | null) => void;
}

export const useWorkSamplesForm =  ({ person, setPerson }: WorkSamplesFormProps)  => {
    const { t } = useTranslation();
    const { successMessage, errorMessage } = useNotification();
    const { execute: saveUserSettings, isMutating: isSubmitting } = useHttpPost('saveUserSettings');

    const FormSchema = z.object({
        title: z
            .string()
            .min(1, t('profileInfo.sampleTitleRequired'))
            .refine((value) => value.trim().length > 0, {
                message: t('profileInfo.invalidTitle'),
            }),
        sampleUrl: z
            .string()
            .min(1, t('profileInfo.sampleUrlRequired'))
            .refine(
                (value) => {
                    try {
                        new URL(value);
                        return true;
                    } catch {
                        return (
                            process.env.NODE_ENV === 'development' &&
                            (value.startsWith('http://localhost') || value.startsWith('https://localhost'))
                        );
                    }
                },
                { message: t('profileInfo.invalidUrl') },
            ),
        description: z
            .string()
            .min(1, t('profileInfo.sampleDescriptionRequired'))
            .refine((value) => value.trim().length > 0, {
                message: t('profileInfo.invalidDescription'),
            }),
    });

    const initialWorkSamples: WorkSample[] = person?.workSamples ?? [];

    const [form, setForm] = useState<FormValues>({
        workSamples: initialWorkSamples,
        newSample: { title: '', sampleUrl: '', description: '' },
        displayName: person?.displayName ?? '',
        bio: person?.bio ?? '',
        skills: person?.skills ?? '',
        contacts: person?.contacts ?? '',
        portfolioPics: person?.portfolioPics ?? [],
    });
    const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
    const [errors, setErrors] = useState<Partial<Record<keyof FormValues['newSample'], string>>>({});

    // Keep `form` in sync with `person` whenever the person reference changes (e.g. loaded
    // asynchronously, or updated elsewhere in the store). Adjusting state directly during
    // render (instead of in an effect) avoids the extra render pass a post-commit effect would
    // cause. See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    const [prevPerson, setPrevPerson] = useState(person);
    if (person && person !== prevPerson) {
        setPrevPerson(person);
        const newForm = {
            ...form,
            workSamples: person.workSamples ?? initialWorkSamples,
            displayName: person.displayName ?? form.displayName,
            bio: person.bio ?? form.bio,
            skills: person.skills ?? form.skills,
            contacts: person.contacts ?? form.contacts,
            portfolioPics: person.portfolioPics ?? form.portfolioPics,
        };
        if (!isEqual(newForm, form)) {
            setForm(newForm);
        }
    }

    const validateField = async <K extends keyof FormValues['newSample']>(
        key: K,
        value: FormValues['newSample'][K],
    ) => {
        const tempSample = { ...form.newSample, [key]: value };
        const result = await FormSchema.safeParseAsync(tempSample);
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

    const onSubmit = async (
        action: 'addSample' | 'editSample' | 'deleteSample' | 'update',
        workSamples: WorkSample[],
        sampleId?: string,
    ) => {
        try {
            const payload: SaveUserSettings = {
                workSamples,
                displayName: form.displayName,
                bio: form.bio,
                skills: form.skills,
                contacts: form.contacts,
                portfolioPics: form.portfolioPics,
            };

            const response = await saveUserSettings(payload);

            if (response.state === REQUEST_STATE.FAILED) {
                const messageError = t('error.title');
                errorMessage(null, null, messageError);
                return false;
            }
            const currentPerson = person ?? null;

            // optimistic update to the store so all pages reflect immediately
            if (currentPerson) {
                setPerson({ ...currentPerson, workSamples: payload.workSamples });
            }
            successMessage(null, null, t(`profileInfo.${action}`) ?? 'Success!');
            return true;
        } catch (error) {
            errorMessage(null, null, t('error.title') ?? 'Submission failed!');
            return false;
        }
    };

    const addSample = async () => {
        const result = await FormSchema.safeParseAsync(form.newSample);
        if (!result.success) {
            const newErrors: Partial<Record<keyof FormValues['newSample'], string>> = {};
            result.error.issues.forEach((issue) => {
                newErrors[issue.path[0] as keyof FormValues['newSample']] = issue.message;
            });
            setErrors(newErrors);
            return false;
        }

        const newSample = {
            id: uuidv4(),
            title: form.newSample.title,
            sampleUrl: form.newSample.sampleUrl,
            description: form.newSample.description,
        };

        const newWorkSamples = [...form.workSamples, newSample];
        setForm((prev) => ({
            ...prev,
            workSamples: newWorkSamples,
            newSample: { title: '', sampleUrl: '', description: '' },
        }));
        setErrors({});

        return await onSubmit('addSample', newWorkSamples);
    };

    const editSample = async (id: string) => {
        const result = await FormSchema.safeParseAsync(form.newSample);
        if (!result.success) {
            const newErrors: Partial<Record<keyof FormValues['newSample'], string>> = {};
            result.error.issues.forEach((issue) => {
                newErrors[issue.path[0] as keyof FormValues['newSample']] = issue.message;
            });
            setErrors(newErrors);
            return false;
        }

        const newWorkSamples = form.workSamples.map((sample) =>
            sample.id === id
                ? {
                    ...sample,
                    title: form.newSample.title,
                    sampleUrl: form.newSample.sampleUrl,
                    description: form.newSample.description,
                }
                : sample,
        );

        setForm((prev) => ({
            ...prev,
            workSamples: newWorkSamples,
            newSample: { title: '', sampleUrl: '', description: '' },
        }));
        setEditingSampleId(null);
        setErrors({});

        return await onSubmit('editSample', newWorkSamples, id);
    };

    const deleteSample = async (id: string) => {
        const previousWorkSamples = form.workSamples;
        const newWorkSamples = form.workSamples.filter((sample) => sample.id !== id);

        setForm((prev) => ({
            ...prev,
            workSamples: newWorkSamples,
        }));

        const success = await onSubmit('deleteSample', newWorkSamples, id);
        if (!success) {
            setForm((prev) => ({
                ...prev,
                workSamples: previousWorkSamples,
            }));
        }
        return success;
    };

    const startEditing = (sample: WorkSample) => {
        setEditingSampleId(sample.id);
        setForm((prev) => ({
            ...prev,
            newSample: { title: sample.title, sampleUrl: sample.sampleUrl, description: sample.description },
        }));
        setErrors({});
    };

    const cancelEditing = () => {
        setEditingSampleId(null);
        setForm((prev) => ({
            ...prev,
            newSample: { title: '', sampleUrl: '', description: '' },
        }));
        setErrors({});
    };

    const resetForm = () => {
        if (window.confirm(t('profileInfo.confirmReset'))) {
            setForm({
                workSamples: person?.workSamples ?? initialWorkSamples,
                newSample: { title: '', sampleUrl: '', description: '' },
                displayName: person?.displayName ?? '',
                bio: person?.bio ?? '',
                skills: person?.skills ?? '',
                contacts: person?.contacts ?? '',
                portfolioPics: person?.portfolioPics ?? [],
            });
            setEditingSampleId(null);
            setErrors({});
        }
    };

    return {
        form,
        setForm,
        errors,
        isSubmitting,
        editingSampleId,
        addSample,
        editSample,
        deleteSample,
        startEditing,
        cancelEditing,
        validateField,
        onSubmit: () => onSubmit('update', form.workSamples),
        resetForm,
    };
};