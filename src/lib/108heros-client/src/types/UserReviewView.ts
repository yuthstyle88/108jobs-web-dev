import {UserReview} from "./UserReview";
import {Person} from "./Person";
import {Workflow} from "./Workflow";

export type UserReviewView = {
    review: UserReview;
    reviewer: Person;
    reviewee: Person;
    workflow: Workflow;
};
