'use client';

import { useCallback, useState } from 'react';
import { REQUEST_STATE } from '@/services/HttpService';
import { useHttpPost } from '@/hooks/api/http/useHttpPost';
import { madGatewayUrl, uploadToMad, type MediaKind, type MediaVisibility } from '@/services/media/madUpload';
import { uploadKindForMime } from '@/modules/chat/hooks/uploadKind';
import { useLocalAttachmentPreviewStore } from '@/modules/chat/store/localAttachmentPreviewStore';

export type UploadedFile = {
    fileUrl: string;
    fileType: string;
    /** What the user called it — this is what recipients see. */
    fileName: string;
    /** What the storage backend knows it by; deletion is keyed on this. */
    storageKey: string;
    /** MAD only. Goes in the chat envelope so the asset stays authorizable. */
    assetId?: string;
} | null;

// Define interface for opts to satisfy Next.js serialization requirements
interface UseFileUploadProps {
    setError: (msg: string | null) => void;
    t: (k: string) => string | undefined;
    /**
     * Who may read what gets uploaded. Defaults to `private`, which is the safe
     * direction to be wrong in: a private asset withheld from someone who
     * should have seen it is a bug report; a public one shown to someone who
     * should not have is a disclosure.
     *
     * Chat attachments are addressed to the people in one room and take the
     * default. Portfolio images are shown on public profiles and must say so —
     * this hook serves both, which is why the choice is a parameter and not a
     * constant.
     *
     * Ignored entirely on the legacy `/account/files` path, which has no such
     * concept and serves everything it stores from one route.
     */
    visibility?: MediaVisibility;
    /**
     * What kind of asset this upload is. Left unset, it is inferred from the
     * file's own mime — see `uploadKindForMime`. Pass it explicitly only when
     * the caller knows better than the mime does. Only meaningful on the MAD
     * path — the legacy `/account/files` endpoint has no such concept.
     */
    kind?: MediaKind;
}

export const useFileUpload = (opts: UseFileUploadProps) => {
    const { setError, t, visibility = 'private', kind } = opts;
    const [selectedFile, setSelectedFile] = useState<UploadedFile>(null);
    const [isDeletingFile, setIsDeletingFile] = useState<boolean>(false);

    const { execute: uploadFile } = useHttpPost('uploadFile');
    const { execute: deleteFile } = useHttpPost('deleteFile');

    const handleFileUpload = useCallback(
        async (e: Event) => {
            try {
                const input = e.target as HTMLInputElement | null;
                const file = (input?.files && input.files[0]) || (e as any).dataTransfer?.files?.[0];
                if (!file) {
                    setError(t('upload.noFile') || 'No file selected');
                    return null;
                }

                const maxSizeMb = 25;
                if (file.size > maxSizeMb * 1024 * 1024) {
                    setError((t as any)('upload.fileTooLarge', { maxSize: maxSizeMb }) || `File too large. Max ${maxSizeMb}MB`);
                    return null;
                }
                const fileType = file.type || 'application/octet-stream';

                setError(null);

                // MAD when `.env` names a gateway, `/account/files` otherwise.
                // The key is unset in every environment today, so this branch
                // is the legacy one until somebody deploys MAD and sets it —
                // which is what makes the cutover safe to land ahead of time.
                let uploaded: UploadedFile;
                if (madGatewayUrl()) {
                    // `kind` is a per-call override for callers that know
                    // better (the resume form uploads a document as `file`
                    // whatever its mime says); everything else infers it from
                    // the file, because taking the old `'image'` default meant
                    // declaring every pdf and video an image.
                    const resolvedKind = kind ?? uploadKindForMime(fileType, file.name);
                    const asset = await uploadToMad(file, visibility, resolvedKind);
                    uploaded = {
                        fileUrl: asset.url,
                        fileType: asset.mimeType || fileType,
                        fileName: asset.originalFilename || file.name,
                        storageKey: asset.filename,
                        assetId: asset.assetId,
                    };

                    // `private` only: this is what lets a chat bubble show the
                    // sender's own just-sent image/video instantly, from the
                    // bytes already in this tab, instead of waiting on a
                    // network round trip -- see localAttachmentPreviewStore.ts.
                    // A `public` upload (e.g. the resume form's `visibility:
                    // 'public'` call) has no optimistic-message concept to
                    // preview into, so there is nothing here that would ever
                    // read it back; registering one anyway would just be a
                    // blob nobody looks up until it self-expires.
                    if (visibility === 'private' && asset.assetId) {
                        useLocalAttachmentPreviewStore
                            .getState()
                            .register(asset.assetId, URL.createObjectURL(file));
                    }
                } else {
                    // Pass file as UploadImage interface
                    const res = await uploadFile({ image: file });
                    if (res.state !== REQUEST_STATE.SUCCESS) {
                        const msg = t('upload.error') || 'Failed to upload file';
                        setError(msg);
                        return null;
                    }

                    const data: any = res.data;
                    const legacyName = String(data?.filename || file.name || 'file');
                    uploaded = {
                        fileUrl: String(data?.url || ''),
                        fileType,
                        fileName: legacyName,
                        storageKey: legacyName,
                    };
                }

                if (!uploaded.fileUrl) {
                    setError(t('upload.error') || 'Failed to upload file');
                    return null;
                }

                setSelectedFile(uploaded);
                if (input) input.value = '';
                return uploaded;
            } catch (err) {
                setError(t('upload.error') || 'Failed to upload file. Please try again later');
                console.error('File upload error:', err); // Debug
                return null;
            }
        },
        [setError, t, uploadFile, visibility, kind],
    );

    const handleRemoveSelectedFile = useCallback(
        async () => {
            if (!selectedFile || isDeletingFile) return;

            try {
                setIsDeletingFile(true);
                setError(null);

                // Deletion is keyed on the storage handle, which is the asset
                // id on MAD and a real filename on the legacy path -- not the
                // display name, which is now the user's own.
                const res = await deleteFile(selectedFile.storageKey);
                if (res.state !== REQUEST_STATE.SUCCESS) {
                    const msg = t('upload.deleteError') || 'Failed to delete file';
                    setError(msg);
                    return;
                }

                setSelectedFile(null);
                console.log('File deleted successfully:', { storageKey: selectedFile.storageKey }); // Debug
            } catch (err) {
                setError(t('upload.deleteError') || 'Failed to delete file');
                console.error('File delete error:', err); // Debug
            } finally {
                setIsDeletingFile(false);
            }
        },
        [isDeletingFile, selectedFile, setError, t, deleteFile],
    );

    return {
        selectedFile,
        setSelectedFile,
        isDeletingFile,
        handleFileUpload,
        handleRemoveSelectedFile,
    } as const;
};