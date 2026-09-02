"use client";

import React from "react";
import {useTranslation} from "react-i18next";

/**
 * แถบแจ้ง "โหลดไม่สำเร็จ" สำหรับใช้ *ในหน้า* — ไม่ใช่ `ErrorState` ที่กินทั้งจอ
 * (`min-h-screen`) และไม่มีปุ่มลองใหม่
 *
 * ทำไมต้องมีตัวนี้: `useHttpGet` ไม่ throw — `HttpService` จับ error เองแล้วคืน
 * `{state: "failed"}` ⇒ `data` เป็น `null` และ `data?.items ?? []` กลายเป็นลิสต์ว่าง
 * ⇒ หน้าที่ไม่อ่าน `state` จะบอกผู้ใช้ว่า "ไม่มีรายการ" ทั้งที่เซิร์ฟเวอร์ล้ม
 *
 * ท่ามาตรฐานที่ให้ลอกไปใช้ทุกหน้าที่ยิง `useHttpGet` แล้วเรนเดอร์ลิสต์:
 *
 * ```tsx
 * const {data, isLoading, state, execute: refetch} = useHttpGet("listThings");
 * const things = data?.things ?? [];
 * const isFetchFailed = isFailed(state);   // จาก "@/services/HttpService"
 *
 * isLoading      ? <Spinner/>
 *   : isFetchFailed ? <FetchErrorState onRetry={refetch}/>   // ← ต้องมาก่อน "ว่าง" เสมอ
 *   : things.length === 0 ? <EmptyState/>
 *   : things.map(...)
 * ```
 *
 * ลำดับสำคัญ: เช็ค `isFetchFailed` **ก่อน** `length === 0` เสมอ ไม่งั้นความล้ม
 * จะถูกกลืนเป็น "ว่าง" อีกครั้ง
 */
export interface FetchErrorStateProps {
    /** เรียก `execute` ที่ `useHttpGet` คืนมา (มักตั้งชื่อว่า `refetch`) */
    onRetry?: () => void;
    /** ปิดปุ่มระหว่างกำลังยิงซ้ำ — ส่ง `isMutating` หรือ `isLoading` เข้ามา */
    isRetrying?: boolean;
    className?: string;
}

export const FetchErrorState: React.FC<FetchErrorStateProps> = ({
    onRetry,
    isRetrying = false,
    className = "",
}) => {
    const {t} = useTranslation();

    return (
        <div
            role="alert"
            data-testid="fetch-error-state"
            className={`text-center py-12 px-4 bg-red-50 border border-red-200 rounded-2xl ${className}`}
        >
            <svg
                className="w-12 h-12 text-red-500 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
            <p className="mt-3 text-lg font-semibold text-red-600">
                {t("global.failedToLoad")}
            </p>
            <p className="mt-1 text-sm text-red-700/80">
                {t("global.loadFailedHint")}
            </p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <svg
                        className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    {t("global.retry")}
                </button>
            )}
        </div>
    );
};

export interface FetchErrorRowProps extends FetchErrorStateProps {
    /** จำนวนคอลัมน์ของตารางที่ครอบอยู่ */
    colSpan: number;
}

/** ตัวเดียวกัน แต่ห่อเป็นแถวตาราง สำหรับหน้าที่เรนเดอร์ลิสต์ใน `<tbody>` */
export const FetchErrorRow: React.FC<FetchErrorRowProps> = ({colSpan, ...rest}) => (
    <tr>
        <td colSpan={colSpan} className="p-4">
            <FetchErrorState {...rest} />
        </td>
    </tr>
);

export default FetchErrorState;
