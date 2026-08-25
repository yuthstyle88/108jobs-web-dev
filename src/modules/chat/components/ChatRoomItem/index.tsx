"use client";
import React from "react";
import type {LocalUser} from "108heros-client";
import Link from "next/link";
import AvatarBadge from "@/components/AvatarBadge";
import {usePeerOnline} from "@/modules/chat/store/presenceStore";
import {useRoomsStore} from "@/modules/chat/store/roomsStore";
import {RoomView} from "@/modules/chat/types";
import {RoomNotFound} from "@/components/RoomNotFound";

interface ChatRoomListProps {
    room: RoomView;
    currentLang: string;
    localUser?: Pick<LocalUser, "id"> | null;
}

const ChatRoomItem = ({room, currentLang, localUser}: ChatRoomListProps) => {
    const {findPartner, getUnread, markRoomRead} = useRoomsStore();
    const isActive = room.isActive;

    const partner = findPartner(room.room.id, localUser?.id);
    const jobId = room.post?.id;
    const unreadCount = getUnread(room.room.id);
    const memberId = partner?.id ?? 0;
    const online = usePeerOnline(memberId);

    if (!partner) return <RoomNotFound/>;

    const partnerName = partner.name || "Unknown";
    const handleClick = () => {
        markRoomRead(room.room.id);
    };

    return (
        <Link
            prefetch={false}
            key={room.room.id}
            href={`/${currentLang || "th"}/chat/message/${room.room.id}`}
            className="block mx-2 my-1 transition-colors duration-200 focus:outline-none focus:bg-gray-100"
            aria-label={`Open chat with ${partner?.name} about Job ${jobId}`}
            onClick={handleClick}
        >
            <div
                className={`flex items-center gap-3 p-3 rounded-lg border-b border-blue-950 border-l-4 relative ${
                    isActive
                        ? "bg-blue-50 border-blue-500"
                        : !room.lastMessage
                            ? "bg-white border-yellow-500" // NEW room highlight
                            : "bg-white hover:bg-gray-50 border-transparent"
                }`}
            >
                <AvatarBadge
                    avatarUrl={partner.avatar}
                    name={partnerName}
                    online={online}
                    isActive
                    size={40}
                />
                {/* Room Info */}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-0.5">
                        <h4
                            className="text-sm font-medium text-gray-900 truncate max-w-[200px]"
                            title={partnerName}
                        >
                            {partnerName}
                        </h4>
                        {jobId && (
                            <p
                                className="text-xs text-gray-500 truncate max-w-[200px]"
                                title={`Job ${jobId}`}
                            >
                                {room.post?.name && room.post.name.length > 30 ? room.post.name.slice(0, 30) + ".." : room.post?.name || ""}
                            </p>
                        )}
                    </div>
                </div>
                {/* Unread Badge: Do not show for the active room */}
                {unreadCount > 0 && !isActive && (
                    <span
                        className="ml-auto text-xs bg-blue-500 text-white rounded-full px-2 py-0.5 pointer-events-none"
                    >
                        {unreadCount}
                    </span>
                )}
                {/* NEW Badge - Top Right Corner */}
                {!room.lastMessage && (
                    <span
                        className="absolute top-2 right-2 text-xs text-primary rounded-full px-2 py-0.5 pointer-events-none text-center min-w-[36px]"
                        style={{fontSize: '0.65rem', lineHeight: '1'}}
                    >
                        New
                    </span>
                )}
            </div>
        </Link>
    );
}

export default ChatRoomItem;