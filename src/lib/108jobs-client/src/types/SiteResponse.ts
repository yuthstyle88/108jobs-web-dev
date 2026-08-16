// This file was hand-authored to match the backend's SiteResponse struct.
// Keep in sync with crates/db/src/source/site_view/api.rs in api-108jobs.
import type {SiteView} from "./SiteView";

/**
 * A response for a site edit.
 */
export type SiteResponse = {
  siteView: SiteView;
};
