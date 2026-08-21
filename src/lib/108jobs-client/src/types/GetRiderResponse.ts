import {RiderView} from "./RiderView";
import {RiderApplicationView} from "./RiderApplicationView";

/**
 * NOTE the snake_case key: `rider_view`, not `riderView`. `GetRiderResponse`
 * on the backend deliberately carries no `#[serde(rename_all)]`, so this is
 * really what the server sends -- `crates/contract_tests` pins it. Do not
 * "fix" the casing here; the app parses what the server actually sends.
 */
export type GetRiderResponse = {
    rider_view: RiderView;

    /**
     * Absent for a stranger, who receives only `rider_view`. Optional
     * because the route genuinely varies by caller -- typing it as required
     * would be a lie that surfaces as a runtime crash on the one path it
     * describes.
     */
    application?: RiderApplicationView | null;
};
