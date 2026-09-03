'use server'
import type {IsoData, RouteData} from '@/utils/types';
import type {GetSiteResponse} from '@108-plaza/jh-client';
import fetchIsoData from '@/lib/api/fetchIsoData';
import {IncomingHttpHeaders} from "http";
import {headers} from "next/headers";
import {testHost} from "@/utils/config";

const defaultIsoData: IsoData = {
    path: '/',
    routeData: {} as RouteData,
    siteRes: {} as unknown as GetSiteResponse,
    appUrl: testHost,
    errorPageData: undefined,
};

export default async function isoDataInitializer(): Promise<IsoData | null> {
    const hdr = await headers();
    const url = hdr.get("x-url") || "/";
    const incomingHttpHeaders: IncomingHttpHeaders = Object.fromEntries(Array.from(hdr as any));

    try {
        return await fetchIsoData(url,
          incomingHttpHeaders);
    } catch (error) {
        console.error('Error fetching ISO data:',
          error);
        return defaultIsoData;
    }

}
