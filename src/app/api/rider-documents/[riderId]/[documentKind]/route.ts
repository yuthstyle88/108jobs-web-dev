import {NextRequest, NextResponse} from "next/server";
import type {RiderDocumentKind} from "108heros-client";
import {forwardAuthedUpstream} from "@/utils/authed-upstream-proxy";
import {getApiBase} from "@/utils/env";

/**
 * Runtime mirror of the `RiderDocumentKind` union from `108heros-client`.
 * TypeScript types disappear at compile time, so a route param (a plain
 * string) still needs a concrete allow-list to validate against. Written as
 * `satisfies Record<RiderDocumentKind, true>` so the two can't silently
 * drift apart: adding, removing or renaming a kind in the client package
 * without updating this object is a type error here, not a gap in the
 * allow-list.
 */
const DOCUMENT_KINDS = {
    idCard: true,
    licence: true,
    vehicleRegistration: true,
    insurance: true,
    compulsoryInsurance: true,
    face: true,
    bankBook: true,
} satisfies Record<RiderDocumentKind, true>;

const isDocumentKind = (value: string): value is RiderDocumentKind =>
    Object.prototype.hasOwnProperty.call(DOCUMENT_KINDS, value);

const isPositiveIntegerId = (value: string): boolean => /^[1-9][0-9]*$/.test(value);

/**
 * A closed proxy: two validated values in, one hard-coded backend path out.
 *
 * `riderId` must be a positive integer; `documentKind` must be one of the
 * known kinds. There is no code path by which a request body, a query
 * string or a header reaches the upstream URL, so this route cannot be
 * redirected to an arbitrary address -- unlike `forwardAuthedUpstream`
 * itself, which trusts its caller to have already done this validation.
 */
export async function GET(
    req: NextRequest,
    {params}: {params: Promise<{riderId: string; documentKind: string}>},
) {
    const {riderId, documentKind} = await params;

    if (!isPositiveIntegerId(riderId)) {
        return NextResponse.json({error: "invalid_rider_id"}, {status: 400});
    }
    if (!isDocumentKind(documentKind)) {
        return NextResponse.json({error: "invalid_document_kind"}, {status: 400});
    }

    return forwardAuthedUpstream(
        req,
        `${getApiBase()}/api/v4/riders/profile/${riderId}/documents/${documentKind}`,
    );
}
