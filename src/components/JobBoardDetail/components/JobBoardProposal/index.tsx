"use client";

import {ProfileImage} from "@/constants/images";
import {PaginationControls} from "@/components/PaginationControls";
import {useCursorPagination} from "@/hooks/data/useCursorPagination";
import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import type {ProposalView} from "108jobs-client";
import Image from "next/image";
import React, {useState} from "react";
import {useParams, useRouter} from "next/navigation";
import {dmRoomId} from "@/utils/helpers";
import {MessageCircleMore} from "lucide-react";
import {getLocale} from "@/utils/date";
import {useTranslation} from "react-i18next";
import LoadingMultiCircle from "@/components/Common/Loading/LoadingMultiCircle";
import {useHttpPost} from "@/hooks/api/http/useHttpPost";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";
import {REQUEST_STATE} from "@/services/HttpService";
import {RoomView} from "@/modules/chat/types";
import {useUserStore} from "@/store/useUserStore";

type JobBoardProposalProps = {
    postId?: number;
    jobCreatorId?: number;
};

const JobBoardProposal = ({postId, jobCreatorId}: JobBoardProposalProps) => {
    const {t} = useTranslation();
    const pager = useCursorPagination();
    const [startingChatFor, setStartingChatFor] = useState<number | null>(null);
    const {upsertRoom} = useRoomsStore();
    const {data: proposals, pagination, isMutating: isLoading} = useHttpGet("getProposals", {
        pageCursor: pager.currentCursor,
        ...(postId ? {postId} : {}),
    });
    const {execute: createChatRoom} = useHttpPost("createChatRoom");
    const {person: currentUser} = useUserStore();
    const route = useRouter();
    const params = useParams();
    const currentLang = (params?.lang as string) || 'th';
    const currentLocale = getLocale(currentLang);

    const handleStartChat = async (cv: ProposalView) => {
        const partnerPersonId = (cv as any)?.creator?.id as number | undefined;
        const currentUserId = currentUser?.id;
        if (!partnerPersonId || !currentUserId) return;
        if (partnerPersonId === currentUserId) return;

        const roomId = dmRoomId(currentUserId, partnerPersonId, cv.post.id.toString());
        const roomName = `${cv.post.name}`;

        try {
            setStartingChatFor(partnerPersonId);
            try {
                const res = await createChatRoom({
                    partnerPersonId,
                    roomId,
                    ...(cv.post.id ? {postId: cv.post.id} : {}),
                    ...(cv?.proposal?.id ? {currentProposalId: cv.proposal.id} : {}),
                    roomName,
                });
                if (res.state === REQUEST_STATE.SUCCESS) {
                    upsertRoom(res.data.room as RoomView);
                }
            } catch (e) {
                // If room already exists or API fails, proceed to navigate anyway
            }
            route.push(`/${currentLang}/chat/message/${roomId}?t=${Date.now()}`);
        } finally {
            setStartingChatFor(null);
        }
    };

    if (isLoading) {
        return <LoadingMultiCircle/>
    }

    return (
        <main className="mt-6 md:mt-10 max-w-4xl mx-auto px-4 md:px-0">
            {/* Empty State */}
            {!isLoading && (!proposals?.proposals || proposals.proposals.length === 0) && (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <p className="text-lg font-medium text-text-secondary">
                        {t("jobBoardDetail.noProposal")}
                    </p>
                </div>
            )}

            {/* Proposals List */}
            {proposals?.proposals && proposals.proposals.length > 0 && (
                <div className="space-y-6">
                    {proposals.proposals.map((cv: ProposalView) => (
                        <div
                            key={cv.proposal.id}
                            className="bg-white border border-border-secondary rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                        >
                            <div className="p-5 md:p-6">
                                {/* Mobile-First Flex Layout */}
                                <div className="flex flex-col gap-5">
                                    {/* Top: Avatar + Name + Date */}
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Clickable Profile */}
                                        <button
                                            onClick={() => {
                                                const username = cv.creator?.name || "unknown";
                                                route.push(`/${currentLang}/profile/${username}`);
                                            }}
                                            className="flex items-center gap-3 flex-1 min-w-0 -m-2 p-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                            aria-label={`Go to profile @${cv.creator?.name}`}
                                        >
                                            <Image
                                                src={cv.creator?.avatar || ProfileImage.avatar}
                                                alt={cv.creator?.name || "avatar"}
                                                width={56}
                                                height={56}
                                                className="w-14 h-14 rounded-full object-cover border-2 border-border-secondary flex-shrink-0"
                                            />
                                            <div className="text-left min-w-0">
                                                <p className="text-lg font-semibold text-text-primary truncate">
                                                    {cv.creator?.displayName || cv.creator?.name || "Unknown"}
                                                </p>
                                                <p className="text-sm text-text-secondary truncate">
                                                    @{cv.creator?.name || "unknown"}
                                                </p>
                                            </div>
                                        </button>

                                        {/* Date - Mobile Top Right */}
                                        <div className="text-right">
                                            <p className="text-xs text-text-secondary font-medium whitespace-nowrap">
                                                {new Date(cv.proposal.publishedAt).toLocaleString(currentLocale, {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                    hour: "numeric",
                                                    minute: "numeric",
                                                    hour12: true,
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Proposal Content */}
                                    <div
                                        className="text-text-primary text-base leading-relaxed break-words whitespace-pre-wrap">
                                        {cv.proposal.content}
                                    </div>

                                    {/* Chat Button - Only for Job Creator */}
                                    {currentUser?.id === jobCreatorId && (cv as any)?.creator?.id !== currentUser?.id && (
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={() => handleStartChat(cv)}
                                                disabled={startingChatFor === (cv as any)?.creator?.id}
                                                className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-5 py-3 rounded-xl hover:bg-[#063a68] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                                            >
                                                <MessageCircleMore className="w-5 h-5"/>
                                                {startingChatFor === (cv as any)?.creator?.id ? "..." : t("profile.startChat")}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination && (
                <PaginationControls
                    hasPrevious={pager.hasPreviousPage}
                    hasNext={!!pagination.nextPage}
                    onPrevious={pager.handlePrevPage}
                    onNext={() => pager.handleNextPage(pagination.nextPage)}
                    isLoading={isLoading}
                />
            )}
        </main>
    );
};

export default JobBoardProposal;