import {PostId} from "./PostId";
import {PersonId} from "./PersonId";

export interface PostPreview {
    id: PostId;
    name: string;
    budget: number;
    deadline?: string;
    creatorId: PersonId;
}
