import { verifyTokenResourceAccess } from "./verifyTokenResourceAccess";

export const verifyAccessTokenAccess = verifyTokenResourceAccess(
    "accessTokenId",
    "resourceAccessToken"
);
