import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { resourceHeaderToken } from "@server/db";
import { eq } from "drizzle-orm";
import { db } from "@server/db";
import { OpenAPITags, registry } from "@server/openApi";

const deleteHeaderTokenParamsSchema = z.strictObject({
    headerTokenId: z.string()
});

registry.registerPath({
    method: "delete",
    path: "/header-token/{headerTokenId}",
    description: "Delete a header token.",
    tags: [OpenAPITags.HeaderToken],
    request: {
        params: deleteHeaderTokenParamsSchema
    },
    responses: {}
});

export async function deleteHeaderToken(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = deleteHeaderTokenParamsSchema.safeParse(
            req.params
        );
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { headerTokenId } = parsedParams.data;

        const deleted = await db
            .delete(resourceHeaderToken)
            .where(eq(resourceHeaderToken.headerTokenId, headerTokenId))
            .returning();

        if (deleted.length === 0) {
            return next(
                createHttpError(HttpCode.NOT_FOUND, "Header token not found")
            );
        }

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Header token deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
