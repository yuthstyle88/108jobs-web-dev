// Route definitions for Next.js routing structure

// This list maps the routes to their corresponding Next.js page structure (for reference or generation tools)
// Actual pages should be placed under /app or /pages depending on routing mode
import {GetSiteResponse, MyUserInfo} from "108jobs-client";
import {InitialFetchRequest, IRouteProps, RouteData} from "@/utils/types";
import {LoginFetchConfig,} from "@/components/Authentication/LoginForm/interface";

type RouteComponentProps<PathPropsT> = {
  params: PathPropsT;
};

export interface IRoutePropsWithFetch<
  DataT extends RouteData,
  PathPropsT extends Record<string, string>,
  QueryPropsT extends object,
> extends IRouteProps {
  component: React.ComponentType<RouteComponentProps<PathPropsT> & QueryPropsT>;
  mountedSameRouteNavKey?: string;

  fetchInitialData?(
    req: InitialFetchRequest<PathPropsT, QueryPropsT>,
  ): Promise<DataT>;

  getQueryParams?(
    source: string | undefined,
    siteRes: GetSiteResponse,
    myUserInfo?: MyUserInfo,
  ): QueryPropsT;
}

// Both entries this array ever carried (`/login/:id`, `/comment/:name` -- the
// latter was already copy-paste cruft) pointed at the now-deleted password
// LoginForm and never matched a real App Router path in the first place
// (matchPath() in fetchIsoData.tsx always missed them), so removing them
// changes no runtime behavior.
export const routes: LoginFetchConfig[] = [];