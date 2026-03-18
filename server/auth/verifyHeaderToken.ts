import { db } from "@server/db";
import { resourceHeaderToken } from "@server/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";

/**
 * Hash a raw token value with SHA256 for cache keys and DB lookup.
 */
export function hashHeaderToken(tokenValue: string): string {
    return encodeHexLowerCase(
        sha256(new TextEncoder().encode(tokenValue))
    );
}

/**
 * Verify a header token hash against stored hashes for a resource.
 * Uses SHA256 — fast hashing is fine because 128-bit entropy tokens
 * can't be brute-forced.
 */
export async function verifyHeaderToken({
    tokenHash,
    resourceId
}: {
    tokenHash: string;
    resourceId: number;
}): Promise<{ valid: boolean; headerTokenId?: string }> {
    const [match] = await db
        .select({ headerTokenId: resourceHeaderToken.headerTokenId })
        .from(resourceHeaderToken)
        .where(
            and(
                eq(resourceHeaderToken.resourceId, resourceId),
                eq(resourceHeaderToken.tokenHash, tokenHash),
                or(
                    isNull(resourceHeaderToken.expiresAt),
                    gt(resourceHeaderToken.expiresAt, Date.now())
                )
            )
        )
        .limit(1);

    if (match) {
        return { valid: true, headerTokenId: match.headerTokenId };
    }

    return { valid: false };
}
