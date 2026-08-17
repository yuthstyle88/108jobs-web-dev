'use client';

import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {z} from 'zod';
import {addDaysYMD, isBeforeToday} from '@/utils/helpers';
import {CustomInput} from "@/components/ui/InputField";
import {ProposalId, LocalUserId, PostId} from "108jobs-client";

export interface ProposedQuotePayload {
    partnerId: number;
    postId: number;
    proposalId?: number;
    amount: number;
    proposal: string;
    projectName: string;
    projectDetails: string;
    workingDays: number;
    deliverables: string[];
    note?: string;
    startingDay: string;
    deliveryDay: string;
}

interface QuotationModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Accept any promise return (boolean | void) to be flexible with handlers
    onSubmit: (data: ProposedQuotePayload) => Promise<boolean | void>;
    postId?: PostId;
    proposalId?: ProposalId;
    partnerId: LocalUserId;
    projectName?: string;
    amount?: number;
}

const QuotationModal: React.FC<QuotationModalProps> = ({
                                                           isOpen,
                                                           onClose,
                                                           onSubmit,
                                                           postId,
                                                           proposalId,
                                                           partnerId,
                                                           projectName,
                                                           amount
                                                       }) => {
    const {t} = useTranslation();

    const {ProposedQuoteSchema} = useMemo(() => {
        const WorkStepSchema = z.object({
            seq: z.number().int().min(1, t('profileChat.validation.workStepSeq') || 'Sequence must be at least 1'),
            description: z.string().min(1, t('profileChat.validation.workStepDescription') || 'Work step description is required'),
            amount: z.number().positive({message: t('profileChat.validation.workStepAmount') || 'Work step amount must be greater than 0'}),
            status: z.string(),
        });

        const ProposedQuoteSchema = z.object({
            partnerId: z.number().int().nonnegative(),
            postId: z.number().int().nonnegative(),
            proposalId: z.number().int().nonnegative().optional(),
            amount: z.number().positive({message: t('profileChat.validation.totalAmount') || 'Total amount must be greater than 0'}),
            proposal: z.string().min(1, t('profileChat.validation.invalidForm') || 'Proposal is required'),
            projectName: z.string().min(1, t('profileChat.validation.invalidForm') || 'Project name is required'),
            projectDetails: z.string().min(1, t('profileChat.validation.invalidForm') || 'Project details are required'),
            workingDays: z.number().int().positive({message: t('profileChat.validation.workingDays') || 'Total working days must be greater than 0'}),
            deliverables: z.array(z.string().min(1, t('profileChat.validation.deliverable') || 'Deliverable description is required')).min(1, t('profileChat.validation.deliverables') || 'At least one deliverable is required'),
            note: z.string().optional(),
            startingDay: z.string().min(1, t('profileChat.validation.workStepDates') || 'Both starting and delivery days are required'),
            deliveryDay: z.string().min(1, t('profileChat.validation.workStepDates') || 'Both starting and delivery days are required'),
        }).superRefine((data, ctx) => {
            if (data.startingDay && isBeforeToday(data.startingDay)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('profileChat.validation.startDateNotPast') || 'Start date cannot be earlier than today',
                    path: ['startingDay'],
                });
            }
            if (data.startingDay && data.workingDays > 0 && data.deliveryDay) {
                const expected = addDaysYMD(data.startingDay, data.workingDays);
                if (data.deliveryDay !== expected) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('profileChat.validation.invalidForm') || 'Delivery date must equal start date plus working days',
                        path: ['deliveryDay'],
                    });
                }
            }
        });

        return {WorkStepSchema, ProposedQuoteSchema};
    }, [t]);

    const [form, setForm] = useState<ProposedQuotePayload>({
        partnerId,
        postId: postId ?? 0,
        proposalId: proposalId,
        amount: amount || 0,
        proposal: '',
        projectName: projectName || '',
        projectDetails: '',
        workingDays: 0,
        deliverables: [''],
        note: '',
        startingDay: '',
        deliveryDay: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // postId/proposalId can change while this modal instance stays mounted
    // (the parent may reuse the same modal for a different post/proposal),
    // so derive the effective values directly during render instead of
    // mirroring them into `form` state via an effect.
    const effectiveForm: ProposedQuotePayload = {
        ...form,
        postId: postId ?? 0,
        proposalId,
    };

    const updateField = <K extends keyof ProposedQuotePayload>(key: K, value: ProposedQuotePayload[K]) => {
        setForm((prev) => {
            const updatedForm = {...prev, [key]: value};
            if (key === 'startingDay' || key === 'workingDays') {
                const startingDay = key === 'startingDay' ? value as string : prev.startingDay;
                const workingDays = key === 'workingDays' ? Number(value) : prev.workingDays;
                if (startingDay && !isNaN(workingDays) && workingDays >= 0) {
                    updatedForm.deliveryDay = addDaysYMD(startingDay, workingDays);
                    // Clear deliveryDay error when auto-generated
                    setErrors((prevErrors) => {
                        const newErrors = {...prevErrors};
                        delete newErrors['deliveryDay'];
                        return newErrors;
                    });
                } else {
                    updatedForm.deliveryDay = '';
                }
            }
            return updatedForm;
        });
        validateField(key, value);
    };

    const updateDeliverable = (index: number, value: string) => {
        setForm((prev) => {
            const copy = [...prev.deliverables];
            copy[index] = value;
            return {...prev, deliverables: copy};
        });
        validateDeliverable(index);
    };

    const validateField = async <K extends keyof ProposedQuotePayload>(key: K, value: ProposedQuotePayload[K]) => {
        const tempForm = {...effectiveForm, [key]: value};
        const result = await ProposedQuoteSchema.safeParseAsync(tempForm);
        if (!result.success) {
            const error = result.error.issues.find((issue) => issue.path[0] === key);
            setErrors((prev) => ({
                ...prev,
                [key]: error?.message || '',
            }));
        } else {
            setErrors((prev) => {
                const newErrors = {...prev};
                delete newErrors[key];
                return newErrors;
            });
        }
    };

    const validateDeliverable = async (index: number) => {
        const result = await ProposedQuoteSchema.safeParseAsync(effectiveForm);
        if (!result.success) {
            const path = `deliverables.${index}`;
            const error = result.error.issues.find((issue) => issue.path.join('.') === path);
            setErrors((prev) => ({
                ...prev,
                [path]: error?.message || '',
            }));
        } else {
            setErrors((prev) => {
                const newErrors = {...prev};
                delete newErrors[`deliverables.${index}`];
                return newErrors;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const result = await ProposedQuoteSchema.safeParseAsync(effectiveForm);
        if (!result.success) {
            const newErrors: Record<string, string> = {};
            result.error.issues.forEach((issue) => {
                newErrors[issue.path.join('.')] = issue.message;
            });
            setErrors(newErrors);
            return;
        }

        try {
            await onSubmit(result.data);
            onClose();
        } catch (e: any) {
            setErrors({form: e?.message || t('profileChat.validation.invalidForm') || 'Invalid form data'});
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 pt-10 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-[95%] sm:w-[90%] max-w-3xl shadow-lg">
                <h3 className="text-primary sm:text-lg font-semibold mb-2">{t('profileChat.quotationTitle') || 'Create Quotation'}</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-4">{t('profileChat.quotationDesc') || 'Fill in the quotation details below.'}</p>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4 sm:space-y-5 max-h-[80vh] overflow-y-auto pr-1 text-gray-700"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700">
                                {t('profileChat.projectName') || 'Project Name'}
                            </label>
                            <div
                                className="mt-2 text-sm text-gray-900 bg-gray-100 p-2.5 rounded-md border border-gray-300">
                                {form.projectName || 'N/A'}
                            </div>
                            {errors['projectName'] && (
                                <p className="mt-1 text-xs text-red-600">{errors['projectName']}</p>
                            )}
                        </div>
                        {form.amount !== 0 ? (
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700">
                                    {t('profileChat.amount') || 'Amount (Total)'}
                                </label>
                                <div
                                    className="mt-2 text-sm text-gray-900 bg-gray-100 p-2.5 rounded-md border border-gray-300">
                                    {form.amount || 0}
                                </div>
                                {errors['amount'] && (
                                    <p className="mt-1 text-xs text-red-600">{errors['amount']}</p>
                                )}
                            </div>
                        ) : (<CustomInput
                            label={t('profileChat.amount') || 'Amount (Total)'}
                            name="amount"
                            type="number"
                            value={form.amount === 0 ? '' : form.amount}
                            onChange={(e) => updateField('amount', Number(e.target.value))}
                            error={errors['amount']}
                            placeholder="0"
                            required
                        />)}


                    </div>

                    <CustomInput
                        label={t('profileChat.proposal') || 'Proposal'}
                        name="proposal"
                        type="textarea"
                        value={form.proposal}
                        onChange={(e) => updateField('proposal', e.target.value)}
                        error={errors['proposal']}
                        placeholder={t('profileChat.proposal') || 'Enter proposal details'}
                        required
                    />

                    <CustomInput
                        label={t('profileChat.projectDetails') || 'Project Details'}
                        name="projectDetails"
                        type="textarea"
                        value={form.projectDetails}
                        onChange={(e) => updateField('projectDetails', e.target.value)}
                        error={errors['projectDetails']}
                        placeholder={t('profileChat.projectDetails') || 'Enter project details'}
                        required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
                        <CustomInput
                            label={t('profileChat.workingDays') || 'Working Days (Total)'}
                            name="workingDays"
                            type="number"
                            value={form.workingDays === 0 ? '' : form.workingDays.toString()}
                            onChange={(e) => updateField('workingDays', Number(e.target.value))}
                            error={errors['workingDays']}
                            placeholder="0"
                            required
                        />
                        <CustomInput
                            label={t('profileChat.startingDay') || 'Starting Day'}
                            name="startingDay"
                            type="date"
                            value={form.startingDay}
                            onChange={(e) => updateField('startingDay', e.target.value)}
                            error={errors['startingDay']}
                            required
                        />
                        <CustomInput
                            label={t('profileChat.deliveryDay') || 'Delivery Day'}
                            name="deliveryDay"
                            type="date"
                            value={form.deliveryDay}
                            error={errors['deliveryDay']}
                            readonly
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700">
                            {t('profileChat.deliverables') || 'Deliverables'}{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        {errors['deliverables'] && (
                            <p className="mt-1 text-xs text-red-600">{errors['deliverables']}</p>
                        )}
                        <div className="space-y-2">
                            {form.deliverables.map((d, idx) => (
                                <div key={idx} className="flex gap-2 items-start">
                                    <div className="flex-1">
                                        <CustomInput
                                            name={`deliverables.${idx}`}
                                            value={d}
                                            onChange={(e) => updateDeliverable(idx, e.target.value)}
                                            error={errors[`deliverables.${idx}`]}
                                            placeholder={t('profileChat.exampleDeliverable') || 'Enter deliverable'}
                                            required
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <CustomInput
                        label={t('profileChat.note') || 'Note (optional)'}
                        name="note"
                        type="textarea"
                        value={form.note || ''}
                        onChange={(e) => updateField('note', e.target.value)}
                        error={errors['note']}
                        placeholder={t('profileChat.note') || 'Enter additional notes'}
                    />

                    {errors['form'] && (
                        <p className="text-xs sm:text-sm text-red-600" id="form-error">
                            {errors['form']}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 sm:gap-3 sticky bottom-0 bg-white pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
                        >
                            {t('profileChat.cancel') || 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            className="rounded-md bg-primary px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm text-white hover:bg-[#063a68]"
                        >
                            {t('profileChat.sendQuotation') || 'Send Quotation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuotationModal;