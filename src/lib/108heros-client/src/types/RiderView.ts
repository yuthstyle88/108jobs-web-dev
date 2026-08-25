import {Rider} from "./Rider";
import {Person} from "./Person";

export type RiderView = {
    /** Base rider row */
    rider: Rider;

    /** Person profile */
    person: Person;
};
