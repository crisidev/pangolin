import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { resourceHeaderToken } from "@server/db";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const listHeaderTokensParamsSchema = z.strictObject({
    resourceId: z.string().transform(Number).pipe(z.number().int().positive())
});

export type ListHeaderTokensResponse = {
    tokens: {
        headerTokenId: string;
        title: string | null;
        expiresAt: number | null;
        createdAt: number;
    }[];
};

registry.registerPath({
    method: "get",
    path: "/resource/{resourceId}/header-tokens",
    description: "List all non-expired header tokens for a resource.",
    tags: [OpenAPITags.PublicResource, OpenAPITags.HeaderToken],
    request: {
        params: listHeaderTokensParamsSchema
    },
    responses: {}
});

export async function listHeaderTokens(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = listHeaderTokensParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { resourceId } = parsedParams.data;

        const tokens = await db
            .select({
                headerTokenId: resourceHeaderToken.headerTokenId,
                title: resourceHeaderToken.title,
                expiresAt: resourceHeaderToken.expiresAt,
                createdAt: resourceHeaderToken.createdAt
            })
            .from(resourceHeaderToken)
            .where(
                and(
                    eq(resourceHeaderToken.resourceId, resourceId),
                    or(
                        isNull(resourceHeaderToken.expiresAt),
                        gt(
                            resourceHeaderToken.expiresAt,
                            new Date().getTime()
                        )
                    )
                )
            );

        return response<ListHeaderTokensResponse>(res, {
            data: { tokens },
            success: true,
            error: false,
            message: "Header tokens retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
