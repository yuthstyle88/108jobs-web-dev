'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REQUEST_STATE } from '@/services/HttpService';
import { useHttpPost } from '@/hooks/api/http/useHttpPost';
import { madGatewayUrl, uploadToMad, type MediaKind, type MediaVisibility } from '@/services/media/madUpload';
import { uploadKindForMime } from '@/modules/chat/hooks/uploadKind';
import { classifyMime, type AttachmentKind } from '@/modules/chat/attachments';
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

/**
 * A picked-but-not-yet-necessarily-uploaded file, shown in the composer the
 * instant it is picked. `url` is a local `URL.createObjectURL(file)` blob —
 * the bytes are already in the browser, so this needs no network round trip
 * and stays valid whether the upload is still in flight or has already
 * finished. Lives until the attachment is sent, removed, or replaced by a
 * new pick, at which point its object URL is revoked (see
 * `localAttachmentPreviewStore.ts` for the same lifecycle idiom applied to a
 * different stage of the same attachment's life).
 */
export type AttachmentPreview = {
    url: string;
    kind: AttachmentKind;
    name: string;
};

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
    const [selectedFile, setSelectedFileState] = useState<UploadedFile>(null);
    const [isDeletingFile, setIsDeletingFile] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    // Fraction in [0, 1], or null while indeterminate (no progress event has
    // reported a computable length yet -- e.g. the legacy /account/files path,
    // which has no progress source at all, or the brief window before MAD's
    // first XHR progress event arrives).
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    // Bumped on every new pick and every removal. Anything async (an
    // in-flight uploadToMad call, its onProgress callback) checks this
    // before touching state, so a pick the user has since replaced or
    // removed can never resurrect itself or clobber whatever replaced it.
    const uploadGenerationRef = useRef(0);
    // Mirrors `attachmentPreview` for the unmount cleanup below, which
    // cannot read component state directly.
    const attachmentPreviewRef = useRef<AttachmentPreview | null>(null);
    useEffect(() => {
        attachmentPreviewRef.current = attachmentPreview;
    }, [attachmentPreview]);

    // Revoke whatever preview is still live if this hook instance unmounts
    // mid-upload (room switch, navigation) -- otherwise its blob outlives
    // the component that created it for the rest of the tab's life.
    useEffect(() => {
        return () => {
            if (attachmentPreviewRef.current) {
                URL.revokeObjectURL(attachmentPreviewRef.current.url);
            }
        };
    }, []);

    /** Revokes and clears whatever preview is live, atomically -- a plain
     *  `revoke(); setState(null)` pair would race a concurrent replace. */
    const clearAttachmentPreview = useCallback(() => {
        setAttachmentPreview(prev => {
            if (prev) URL.revokeObjectURL(prev.url);
            return null;
        });
    }, []);

    /** Revokes whatever preview was live and installs `next` in its place,
     *  atomically, for the same reason as `clearAttachmentPreview`. */
    const replaceAttachmentPreview = useCallback((next: AttachmentPreview) => {
        setAttachmentPreview(prev => {
            if (prev) URL.revokeObjectURL(prev.url);
            return next;
        });
    }, []);

    // The only thing outside this hook that ever calls this passes `null`
    // (ChatRoomView.onSubmit / useWorkflowActions, once they have consumed
    // `selectedFile` by sending it) -- so folding the preview's cleanup into
    // the same call is exactly "clear the attachment", not a second concept
    // callers need to remember separately.
    const setSelectedFile = useCallback((value: UploadedFile) => {
        setSelectedFileState(value);
        if (value === null) {
            clearAttachmentPreview();
        }
    }, [clearAttachmentPreview]);

    const { execute: uploadFile } = useHttpPost('uploadFile');
    const { execute: deleteFile } = useHttpPost('deleteFile');

    const handleFileUpload = useCallback(
        async (e: Event) => {
            // Stays null for a call that returns before it ever starts an
            // upload (no file picked, file too large) -- only assigned once
            // this call actually claims a generation, below. Every place that
            // later checks "is this call still current" must also check this
            // is non-null first: without that, a no-op early return could
            // coincidentally match whatever generation number a genuinely
            // in-flight upload already owns and clobber its state.
            let generation: number | null = null;
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

                // A new pick supersedes whatever was previously in flight --
                // cancel its request and revoke its blob before starting this
                // one's.
                abortControllerRef.current?.abort();
                generation = ++uploadGenerationRef.current;
                const isCurrent = () => uploadGenerationRef.current === generation;

                replaceAttachmentPreview({
                    url: URL.createObjectURL(file),
                    kind: classifyMime(fileType, file.name),
                    name: file.name,
                });
                setIsUploading(true);
                setUploadProgress(null);

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

                    const controller = new AbortController();
                    abortControllerRef.current = controller;

                    let asset;
                    try {
                        asset = await uploadToMad(file, visibility, resolvedKind, {
                            signal: controller.signal,
                            onProgress: (fraction) => {
                                if (!isCurrent()) return;
                                setUploadProgress(fraction);
                            },
                        });
                    } catch (err) {
                        if (err instanceof DOMException && err.name === 'AbortError') {
                            // A deliberate cancel (the user removed the file
                            // while it was still uploading) -- not a failure,
                            // so no error toast. handleRemoveSelectedFile has
                            // already cleared the preview/progress state.
                            return null;
                        }
                        throw err;
                    } finally {
                        if (abortControllerRef.current === controller) {
                            abortControllerRef.current = null;
                        }
                    }

                    if (!isCurrent()) {
                        // Superseded by a newer pick or a removal while this
                        // request was finishing -- discard quietly rather than
                        // resurrecting a file the user already moved on from.
                        return null;
                    }

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
                    if (!isCurrent()) return null;
                    if (res.state !== REQUEST_STATE.SUCCESS) {
                        const msg = t('upload.error') || 'Failed to upload file';
                        setError(msg);
                        clearAttachmentPreview();
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
                    clearAttachmentPreview();
                    return null;
                }

                // The raw setState, not the wrapped `setSelectedFile` --
                // committing a value must never also clear the preview that
                // is this same attachment's own thumbnail.
                setSelectedFileState(uploaded);
                if (input) input.value = '';
                return uploaded;
            } catch (err) {
                if (generation !== null && uploadGenerationRef.current === generation) {
                    clearAttachmentPreview();
                }
                setError(t('upload.error') || 'Failed to upload file. Please try again later');
                console.error('File upload error:', err); // Debug
                return null;
            } finally {
                if (generation !== null && uploadGenerationRef.current === generation) {
                    setIsUploading(false);
                }
            }
        },
        [setError, t, uploadFile, visibility, kind, replaceAttachmentPreview, clearAttachmentPreview],
    );

    const handleRemoveSelectedFile = useCallback(
        async () => {
            if (isDeletingFile) return;

            if (isUploading) {
                // Cancel the in-flight upload rather than deleting a finished
                // asset -- there is no finished asset yet. Bumping the
                // generation first means the abort's own rejection (and any
                // progress event still in flight) is guaranteed to see itself
                // as stale even if ordering ever surprises us.
                uploadGenerationRef.current += 1;
                abortControllerRef.current?.abort();
                setIsUploading(false);
                setUploadProgress(null);
                setSelectedFile(null); // no-op on the value; revokes the preview
                return;
            }

            if (!selectedFile) return;

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
        [isDeletingFile, isUploading, selectedFile, setError, t, deleteFile, setSelectedFile],
    );

    return {
        selectedFile,
        setSelectedFile,
        isDeletingFile,
        handleFileUpload,
        handleRemoveSelectedFile,
        isUploading,
        uploadProgress,
        attachmentPreview,
    } as const;
};
