import { verifyTokenResourceAccess } from "./verifyTokenResourceAccess";

export const verifyHeaderTokenAccess = verifyTokenResourceAccess(
    "headerTokenId",
    "resourceHeaderToken"
);
