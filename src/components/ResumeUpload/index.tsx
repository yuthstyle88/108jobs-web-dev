'use client';

import {useTranslation} from 'react-i18next';
import {FileText} from 'lucide-react';
import {useResumeForm} from '@/hooks/forms/useResumeForm';
import {useUserStore} from '@/store/useUserStore';

export default function ResumeUpload() {
    const {t} = useTranslation();
    const {person, setPerson} = useUserStore();
    const {
        fileInputRef,
        handleSelectFile,
        handleFileChange,
        uploadError,
        isSubmitting,
    } = useResumeForm({person: person ?? undefined, setPerson});

    return (
        <div className="border border-border-primary rounded-lg bg-white py-6 mb-8">
            <div className="border-b border-border-primary px-6">
                <h2 className="text-[16px] font-medium mb-2 text-text-primary">
                    {t('profileInfo.sectionResume')}
                </h2>
                <p className="text-gray-600 mb-6 text-[14px] font-sans">
                    {t('profileInfo.subtitleResume')}
                </p>
            </div>

            <div className="px-6">
                {person?.resumeUrl && (
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <FileText className="w-8 h-8 text-primary shrink-0"/>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-800">
                                {person.resumeFileName ?? t('profileInfo.resumeFile')}
                            </p>
                            <a
                                href={person.resumeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                            >
                                {t('profileInfo.download') || 'Download'}
                            </a>
                        </div>
                    </div>
                )}

                <div className="relative flex items-start space-x-4">
                    <div className="flex-1 max-w-md">
                        <div className="w-full h-12 border border-gray-300 rounded-lg flex items-center justify-between px-4 bg-gray-50">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileChange}
                                disabled={isSubmitting}
                            />
                            <span className="text-gray-500 text-sm truncate">
                                {isSubmitting
                                    ? t('profileInfo.uploading') || 'Uploading...'
                                    : person?.resumeUrl
                                        ? t('profileInfo.replaceResume') || 'Replace resume'
                                        : t('profileInfo.selectResume') || 'Select resume file'}
                            </span>
                            <button
                                type="button"
                                onClick={handleSelectFile}
                                className="flex items-center justify-center bg-primary rounded-full p-2 hover:bg-[#063a68] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSubmitting}
                            >
                                <svg
                                    className="w-4 h-4 text-white"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                                </svg>
                            </button>
                        </div>
                        {uploadError && <p className="text-red-600 text-sm mt-2">{uploadError}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
