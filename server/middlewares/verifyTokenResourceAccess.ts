import { Request, Response, NextFunction } from "express";
import { db } from "@server/db";
import {
    resourceAccessToken,
    resourceHeaderToken,
    resources,
    userOrgs
} from "@server/db";
import { and, eq } from "drizzle-orm";
import createHttpError from "http-errors";
import HttpCode from "@server/types/HttpCode";
import { canUserAccessResource } from "@server/auth/canUserAccessResource";
import { checkOrgAccessPolicy } from "#dynamic/lib/checkOrgAccessPolicy";

const tokenTables = {
    resourceAccessToken: {
        table: resourceAccessToken,
        idColumn: resourceAccessToken.accessTokenId,
        resourceIdColumn: resourceAccessToken.resourceId
    },
    resourceHeaderToken: {
        table: resourceHeaderToken,
        idColumn: resourceHeaderToken.headerTokenId,
        resourceIdColumn: resourceHeaderToken.resourceId
    }
} as const;

type TokenTableName = keyof typeof tokenTables;

export function verifyTokenResourceAccess(
    paramName: string,
    tableName: TokenTableName
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user!.userId;
        const tokenId = req.params[paramName];

        if (!userId) {
            return next(
                createHttpError(
                    HttpCode.UNAUTHORIZED,
                    "User not authenticated"
                )
            );
        }

        try {
        const { table, idColumn, resourceIdColumn } = tokenTables[tableName];

        const [token] = await db
            .select({ resourceId: resourceIdColumn })
            .from(table)
            .where(eq(idColumn, tokenId))
            .limit(1);

        if (!token) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Token with ID ${tokenId} not found`
                )
            );
        }

        const resourceId = token.resourceId;
            const [resource] = await db
                .select()
                .from(resources)
                .where(eq(resources.resourceId, resourceId))
                .limit(1);

            if (!resource) {
                return next(
                    createHttpError(
                        HttpCode.NOT_FOUND,
                        `Resource with ID ${resourceId} not found`
                    )
                );
            }

            if (!resource.orgId) {
                return next(
                    createHttpError(
                        HttpCode.INTERNAL_SERVER_ERROR,
                        `Resource with ID ${resourceId} does not have an organization ID`
                    )
                );
            }

            if (!req.userOrg) {
                const result = await db
                    .select()
                    .from(userOrgs)
                    .where(
                        and(
                            eq(userOrgs.userId, userId),
                            eq(userOrgs.orgId, resource.orgId)
                        )
                    );
                req.userOrg = result[0];
            }

            if (!req.userOrg) {
                return next(
                    createHttpError(
                        HttpCode.FORBIDDEN,
                        "User does not have access to this organization"
                    )
                );
            }

            req.userOrgRoleId = req.userOrg.roleId;
            req.userOrgId = resource.orgId!;

            if (req.orgPolicyAllowed === undefined && req.userOrg.orgId) {
                const policyCheck = await checkOrgAccessPolicy({
                    orgId: req.userOrg.orgId,
                    userId,
                    session: req.session
                });
                req.orgPolicyAllowed = policyCheck.allowed;
                if (!policyCheck.allowed || policyCheck.error) {
                    return next(
                        createHttpError(
                            HttpCode.FORBIDDEN,
                            "Failed organization access policy check: " +
                                (policyCheck.error || "Unknown error")
                        )
                    );
                }
            }

            const resourceAllowed = await canUserAccessResource({
                userId,
                resourceId,
                roleId: req.userOrgRoleId!
            });

            if (!resourceAllowed) {
                return next(
                    createHttpError(
                        HttpCode.FORBIDDEN,
                        "User does not have access to this resource"
                    )
                );
            }

            next();
        } catch (e) {
            return next(
                createHttpError(
                    HttpCode.INTERNAL_SERVER_ERROR,
                    "Error verifying organization access"
                )
            );
        }
    };
}
