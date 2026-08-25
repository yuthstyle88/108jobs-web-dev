import {LocalUserId} from "./LocalUserId";

export interface LastMessage {
    content: string;
    timestamp: string;
    senderId: LocalUserId;
}