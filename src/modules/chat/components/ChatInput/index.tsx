"use client";

import { Paperclip, Send, Smile } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react"; // Default import
import { createPortal } from "react-dom";

type MessageForm = { message: string };

interface ChatInputProps {
    onSubmit: (data: MessageForm) => void;
    disabled?: boolean;
    disabledHint?: string;
    /**
     * A picked file is still uploading -- true from the moment a file is
     * selected until `useFileUpload` either resolves it into `selectedFile`
     * or fails. Shows a spinner over the paperclip, and -- unlike `disabled`,
     * which also greys out the textarea -- blocks only sending: the envelope
     * needs the final assetId/URL, which does not exist yet, but a caption
     * can still be typed while the upload finishes. Blocking submission
     * without also disabling+styling the Send button would repeat the exact
     * silently-dead-button bug `hasAttachment` below was added to fix, just
     * for a different cause.
     */
    isUploading?: boolean;
    onFileUpload?: (e: Event) => void;
    onTyping?: (typing: boolean) => void;
    typingHint?: string;
    sendLatestRead: () => void;
    /**
     * Whether a file is currently attached and ready to send. ChatInput owns
     * the message text but not the selected file (that lives in
     * `ChatRoomView`), so without this it has no way to know an empty
     * textarea still has something worth sending -- see `internalSubmit`.
     */
    hasAttachment?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
                                                 onSubmit,
                                                 disabled = false,
                                                 disabledHint,
                                                 isUploading,
                                                 onFileUpload,
                                                 onTyping,
                                                 typingHint,
                                                 sendLatestRead,
                                                 hasAttachment = false,
                                             }) => {
    const { t } = useTranslation();
    const { register, handleSubmit, reset, watch, setValue, getValues } = useForm<MessageForm>();
    const messageRef = useRef<HTMLTextAreaElement | null>(null);
    const { ref, ...rest } = register("message");

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);

    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingLastSentAtRef = useRef<number>(0);
    const typingLastStateRef = useRef<boolean | null>(null);
    const TYPING_TRUE_THROTTLE_MS = 5000;
    const TYPING_STOP_DEBOUNCE_MS = 1500;

    // === EMOJI INSERTION ===
    const insertEmojiAtCursor = useCallback(
        (emoji: string) => {
            const textarea = messageRef.current;
            if (!textarea) return;

            const start = textarea.selectionStart ?? 0;
            const end = textarea.selectionEnd ?? 0;
            const current = getValues("message") || "";

            const newValue = current.slice(0, start) + emoji + current.slice(end);
            setValue("message", newValue, { shouldValidate: true });

            // Focus and set cursor
            requestAnimationFrame(() => {
                textarea.focus();
                const newPos = start + emoji.length;
                textarea.setSelectionRange(newPos, newPos);
                resizeTextarea();
            });
        },
        [getValues, setValue]
    );

    // === POSITION PICKER ABOVE SMILEY BUTTON ===
    useEffect(() => {
        if (!showEmojiPicker || !emojiButtonRef.current || !pickerRef.current) return;

        const button = emojiButtonRef.current;
        const picker = pickerRef.current;
        const rect = button.getBoundingClientRect();

        // Position picker directly above the button
        const top = rect.top - 410; // height + margin
        const left = rect.left - 280; // align to right edge of button

        picker.style.position = "fixed";
        picker.style.top = `${top}px`;
        picker.style.left = `${left}px`;
        picker.style.zIndex = "50";
    }, [showEmojiPicker]);

    // === CLOSE ON OUTSIDE CLICK ===
    useEffect(() => {
        if (!showEmojiPicker) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                emojiButtonRef.current &&
                !emojiButtonRef.current.contains(e.target as Node) &&
                pickerRef.current &&
                !pickerRef.current.contains(e.target as Node)
            ) {
                setShowEmojiPicker(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showEmojiPicker]);

    // === TEXTAREA RESIZE ===
    const resizeTextarea = () => {
        const textarea = messageRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    useEffect(() => {
        resizeTextarea();
    }, [watch("message")]);

    // === SUBMIT ===
    // Also blocked while a file is still uploading: the envelope needs the
    // final assetId/URL, which only exists once useFileUpload resolves it
    // into `selectedFile`. The Send button below mirrors this in its own
    // `disabled` attribute so the block is visible, not just silent.
    const sendBlocked = disabled || Boolean(isUploading);

    const internalSubmit = (data: MessageForm) => {
        if (sendBlocked) return;
        const text = (data.message ?? "").trim();
        // A file attached with no caption is a legitimate send -- only block
        // when there is truly nothing to send.
        if (!text && !hasAttachment) return;
        onSubmit({ message: text });
        onTyping?.(false);
        typingLastStateRef.current = false;
        typingLastSentAtRef.current = Date.now();
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        reset();
        setTimeout(resizeTextarea, 0);
    };

    // === DRAG & DROP (unchanged) ===
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounterRef.current++; setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounterRef.current--; if (dragCounterRef.current <= 0) setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); dragCounterRef.current = 0; setIsDragging(false);
        onFileUpload?.(e.nativeEvent as unknown as Event);
    };

    useEffect(() => {
        const onWindowDragLeave = () => { setIsDragging(false); dragCounterRef.current = 0; };
        window.addEventListener("dragleave", onWindowDragLeave);
        return () => window.removeEventListener("dragleave", onWindowDragLeave);
    }, []);

    return (
        <form onSubmit={handleSubmit(internalSubmit)} className="flex flex-col gap-2">
            <div className="flex items-center w-full">
                {/* File Upload */}
                <input type="file" id="fileInput" className="hidden" onChange={(e) => onFileUpload?.(e.nativeEvent as unknown as Event)} />
                <label htmlFor="fileInput" className="text-gray-400 hover:text-gray-600 mr-3 cursor-pointer">
                    {isUploading ? <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" /> : <Paperclip size={20} />}
                </label>

                {/* Input Wrapper */}
                <div
                    className={`relative flex-1 text-black border rounded-lg overflow-hidden flex transition-colors ${
                        isDragging ? "border-dashed bg-blue-50 border-blue-400" : ""
                    }`}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {isDragging && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-blue-50/70 text-blue-700 text-sm">
                            {t("profileChat.dropFiles") || "Drop files"}
                        </div>
                    )}

                    {/* Textarea */}
                    <textarea
                        {...rest}
                        ref={(e) => {
                            ref(e);
                            messageRef.current = e;
                        }}
                        placeholder={
                            disabled
                                ? disabledHint ?? t("profileChat.userNotAvailable") ?? "Not available"
                                : typingHint ?? t("profileChat.typeMessageHere") ?? "Type a message..."
                        }
                        className={`flex-1 px-3 py-2 resize-none focus:outline-none min-h-[40px] max-h-[150px] overflow-y-auto break-words whitespace-pre-wrap ${
                            disabled ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
                        }`}
                        rows={1}
                        disabled={disabled}
                        onKeyDown={(e) => {
                            if (disabled || (e as any).isComposing) return;
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                e.currentTarget.closest("form")?.requestSubmit();
                            }
                        }}
                        onFocus={sendLatestRead}
                        onClick={sendLatestRead}
                        onChange={(e) => {
                            rest.onChange?.(e);
                            resizeTextarea();

                            const val = e.target.value;
                            const now = Date.now();
                            const isTyping = val.trim().length > 0;

                            if (isTyping) {
                                const elapsed = now - (typingLastSentAtRef.current || 0);
                                if (typingLastStateRef.current !== true || elapsed >= TYPING_TRUE_THROTTLE_MS) {
                                    onTyping?.(true);
                                    typingLastStateRef.current = true;
                                    typingLastSentAtRef.current = now;
                                }
                            }

                            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                            typingTimerRef.current = setTimeout(() => {
                                const empty = !messageRef.current || messageRef.current.value.trim() === "";
                                if (empty && typingLastStateRef.current !== false) {
                                    onTyping?.(false);
                                    typingLastStateRef.current = false;
                                    typingLastSentAtRef.current = Date.now();
                                }
                            }, TYPING_STOP_DEBOUNCE_MS);
                        }}
                    />

                    {/* Emoji Button */}
                    <button
                        ref={emojiButtonRef}
                        type="button"
                        className={`px-3 bg-white ${disabled ? "text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
                        disabled={disabled}
                        onClick={() => !disabled && setShowEmojiPicker((v) => !v)}
                    >
                        <Smile size={20} />
                    </button>

                    {/* Emoji Picker Portal */}
                    {showEmojiPicker &&
                        createPortal(
                            <div
                                ref={pickerRef}
                                className="bg-white rounded-lg shadow-xl border"
                                style={{ width: 320, height: 400 }}
                            >
                                <EmojiPicker
                                    onEmojiClick={(emojiData: EmojiClickData) => {
                                        insertEmojiAtCursor(emojiData.emoji);
                                        setShowEmojiPicker(false);
                                    }}
                                    lazyLoadEmojis={true}
                                    skinTonesDisabled={true}
                                    width="100%"
                                    height="100%"
                                />
                            </div>
                            ,
                            document.body
                        )}
                </div>

                {/* Send Button */}
                <button
                    type="submit"
                    className={`ml-3 ${sendBlocked ? "text-gray-300" : "text-blue-500 hover:text-primary"}`}
                    disabled={sendBlocked}
                    aria-label={t("profileChat.sendMessage") || "Send message"}
                    aria-disabled={sendBlocked}
                    title={isUploading ? t("profileChat.uploadingLabel") || "Uploading" : undefined}
                >
                    <Send size={20} />
                </button>
            </div>
        </form>
    );
};

export default ChatInput;