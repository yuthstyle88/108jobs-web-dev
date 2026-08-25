import React from "react";
import {RequestState} from "@/services/HttpService";
import {GetSiteResponse, IdentityPlatformLoginResponse, PublicOAuthProvider,} from "108heros-client";
import {RouteData} from "@/utils/types"
import {IRoutePropsWithFetch} from "@/utils/routes";

export interface LoginFormProps {
  formState: {
    usernameOrEmail: string;
    password: string;
  };
  setFormState: React.Dispatch<
    React.SetStateAction<{
      usernameOrEmail: string;
      password: string;
    }>
  >;
  switchToRegister: () => void;
  switchToForgotPassword: () => void;
}


export interface State {
  loginRes: RequestState<IdentityPlatformLoginResponse>;
  form: {
    usernameOrEmail: string;
    password: string;
  };

  siteRes: GetSiteResponse | null;
  showOAuthModal: boolean;
  showPassword: boolean;
  oauthProviders: PublicOAuthProvider[];
  hasFetchedSite: boolean;
}

export interface LoginFormState {
  showPassword: boolean;
  oauthProviders: PublicOAuthProvider[];
  hasFetchedSite: boolean;
}

export interface LoginProps {
  prev?: string;
}

export type LoginFetchConfig = IRoutePropsWithFetch<
  RouteData,
  Record<string, never>,
  LoginProps
>;