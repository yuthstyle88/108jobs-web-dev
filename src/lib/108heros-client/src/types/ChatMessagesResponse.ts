import type {ChatMessageView} from "./ChatMessageView";
import type {PaginationCursor} from "./PaginationCursor";

export type ChatMessagesResponse = {
  results: ChatMessageView[];
  nextPage?: PaginationCursor;
  prevPage?: PaginationCursor;
};
