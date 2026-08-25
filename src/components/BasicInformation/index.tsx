'use client';

import ImageUploadModal from '@/components/Common/Modal/AvatarUploadModal';
import { ProfileImage } from '@/constants/images';
import { useHttpPost } from '@/hooks/api/http/useHttpPost';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { useProfileForm } from '@/hooks/forms/useProfileForm';
import { CustomInput } from '@/components/ui/InputField';
import {useImagePicker} from "@/hooks/ui/useImagePicker";
import {useUserStore} from "@/store/useUserStore";

export default function BasicInformation() {
    const { t } = useTranslation();
    const { execute: uploadUserAvatar } = useHttpPost('uploadUserAvatar');
    const { person } = useUserStore();

    // Avatar image picker
    const {
        selectedImage: selectedAvatar,
        setSelectedImage: setSelectedAvatar,
        isImageModalOpen: isAvatarModalOpen,
        fileInputRef: avatarFileInputRef,
        handleFileChange: handleAvatarFileChange,
        handleSelectFile: handleSelectAvatarFile,
        handleImageUpload: handleAvatarImageUpload,
        closeImageModal: closeAvatarImageModal,
    } = useImagePicker(!person ? person : undefined);

    const {
        form,
        setForm,
        errors,
        onSubmit,
        validateField,
    } = useProfileForm(person ?? undefined, setSelectedAvatar, person?.portfolioPics, person?.workSamples);

    const updateField = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        validateField(key, value);
    };

    return (
        <>
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    const success = await onSubmit();
                    if (success) {
                        window.location.reload();
                    }
                }}
                className="border border-border-primary rounded-lg bg-white py-4 sm:py-6 mb-8"
            >
                <div className="border-b border-border-primary px-6">
                    <h2 className="text-sm sm:text-lg font-semibold text-gray-700 mb-2">
                        {t('profileInfo.sectionAccountInfo')}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
                        {t('profileInfo.subtitleAccountInfo')}
                    </p>
                </div>

                <div className="flex justify-center my-6 sm:my-8 px-6">
                    <div className="relative">
                        <div
                            onClick={handleSelectAvatarFile}
                            className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <input
                                type="file"
                                ref={avatarFileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarFileChange}
                            />
                            <Image
                                src={selectedAvatar ? selectedAvatar : ProfileImage.avatar}
                                alt="avatar"
                                className="w-full h-full rounded-full"
                                width={500}
                                height={500}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSelectAvatarFile}
                            className="absolute bottom-0 right-0 bg-primary rounded-full p-2"
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
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="space-y-4 sm:space-y-5 px-6">
                    <div className="w-full">
                        <CustomInput
                            tag="input"
                            type="text"
                            name="username"
                            value={form.username}
                            readonly={true}
                            label={t('profileInfo.labelUsername')}
                            placeholder={t('profileInfo.labelUsername') || 'Enter username'}
                            error={errors.username}
                            prefix="108heros.com/profile/"
                            aria-describedby={errors.username ? 'username-error' : undefined}
                        />
                    </div>

                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            {t('profileInfo.labelDisplayName')}
                            <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-600 mb-2">{t('profileInfo.nameTrustNote')}</p>
                        <CustomInput
                            tag="input"
                            type="text"
                            name="displayName"
                            placeholder={t('profileInfo.labelDisplayName') || 'Enter display name'}
                            value={form.displayName}
                            onChange={(e) => updateField('displayName', e.target.value)}
                            error={errors.displayName}
                            required
                            aria-describedby={errors.displayName ? 'displayName-error' : undefined}
                        />
                    </div>

                    <div>
                        <CustomInput
                            tag="textarea"
                            type="textarea"
                            name="bio"
                            label={t('profileInfo.bio')}
                            placeholder={t('profileInfo.bioPlaceholder') || 'Tell us about yourself'}
                            value={form.bio}
                            onChange={(e) => updateField('bio', e.target.value)}
                            error={errors.bio}
                            rows={5}
                            aria-describedby={errors.bio ? 'bio-error' : undefined}
                        />
                    </div>

                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            {t('profileInfo.sectionCoreSkills')}
                        </label>
                        <p className="text-xs text-gray-600 mb-2">{t('profileInfo.subtitleCoreSkills')}</p>
                        <CustomInput
                            tag="input"
                            type="text"
                            name="skills"
                            placeholder={t('profileInfo.coreSkillPlaceholder') || 'Enter your skills'}
                            value={form.skills}
                            onChange={(e) => updateField('skills', e.target.value)}
                            error={errors.skills}
                            aria-describedby={errors.skills ? 'skills-error' : undefined}
                        />
                    </div>

                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                            {t('profileInfo.sectionContactInfo')}
                        </label>
                        <p className="text-xs text-gray-600 mb-2">{t('profileInfo.subtitleContactInfo')}</p>
                        <CustomInput
                            tag="textarea"
                            type="textarea"
                            name="contacts"
                            placeholder={t('profileInfo.customContactPlaceholder') || 'Enter contact information'}
                            value={form.contacts}
                            onChange={(e) => updateField('contacts', e.target.value)}
                            error={errors.contacts}
                            rows={3}
                            aria-describedby={errors.contacts ? 'contacts-error' : undefined}
                        />
                    </div>

                    <div className="flex justify-end gap-2 sm:gap-3">
                        <button
                            type="submit"
                            className="rounded-md bg-primary px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm text-white hover:bg-[#063a68]"
                        >
                            {t('profileInfo.save')}
                        </button>
                    </div>
                </div>
            </form>

            <ImageUploadModal
                isOpen={isAvatarModalOpen}
                onClose={closeAvatarImageModal}
                onImageUpload={(imageUrl: string) => {
                    handleAvatarImageUpload(imageUrl);
                    window.location.reload();
                }}
                uploadImage={uploadUserAvatar}
            />
        </>
    );
}