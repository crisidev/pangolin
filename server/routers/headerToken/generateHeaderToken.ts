import {
    generateId,
    generateIdFromEntropySize
} from "@server/auth/sessions/app";
import { db } from "@server/db";
import { resourceHeaderToken } from "@server/db";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { createDate, TimeSpan } from "oslo";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { OpenAPITags, registry } from "@server/openApi";

const generateHeaderTokenBodySchema = z.strictObject({
    title: z.string().max(255).optional(),
    expiresIn: z.number().int().positive().optional() // seconds from now; omit = never expires
});

const generateHeaderTokenParamsSchema = z.strictObject({
    resourceId: z.string().transform(Number).pipe(z.number().int().positive())
});

export type GenerateHeaderTokenResponse = {
    headerTokenId: string;
    orgId: string;
    resourceId: number;
    title: string | null;
    expiresAt: number | null;
    createdAt: number;
    token: string;
};

registry.registerPath({
    method: "post",
    path: "/resource/{resourceId}/header-token",
    description:
        "Generate a new header token for a resource. The plain token is returned only once.",
    tags: [OpenAPITags.PublicResource, OpenAPITags.HeaderToken],
    request: {
        params: generateHeaderTokenParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: generateHeaderTokenBodySchema
                }
            }
        }
    },
    responses: {}
});

export async function generateHeaderToken(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedBody = generateHeaderTokenBodySchema.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const parsedParams = generateHeaderTokenParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedParams.error).toString()
            )
        );
    }

    const { resourceId } = parsedParams.data;
    const { title, expiresIn } = parsedBody.data;
    const orgId = req.userOrgId!;

    try {
        const expiresAt = expiresIn
            ? createDate(new TimeSpan(expiresIn, "s")).getTime()
            : undefined;

        // 128 bits of entropy — brute-force infeasible regardless of hash speed
        const token = generateIdFromEntropySize(16);

        // SHA256 lets us do a direct DB lookup by hash instead of loading all tokens
        const tokenHash = encodeHexLowerCase(
            sha256(new TextEncoder().encode(token))
        );

        const id = generateId(8);
        const [result] = await db
            .insert(resourceHeaderToken)
            .values({
                headerTokenId: id,
                orgId,
                resourceId,
                tokenHash,
                expiresAt: expiresAt || null,
                title: title || null,
                createdAt: new Date().getTime()
            })
            .returning({
                headerTokenId: resourceHeaderToken.headerTokenId,
                orgId: resourceHeaderToken.orgId,
                resourceId: resourceHeaderToken.resourceId,
                expiresAt: resourceHeaderToken.expiresAt,
                title: resourceHeaderToken.title,
                createdAt: resourceHeaderToken.createdAt
            })
            .execute();

        if (!result) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Failed to generate header token"
                )
            );
        }

        return response<GenerateHeaderTokenResponse>(res, {
            data: { ...result, token },
            success: true,
            error: false,
            message: "Header token generated successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error(e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to generate header token"
            )
        );
    }
}
