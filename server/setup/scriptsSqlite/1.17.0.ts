import { db } from "@server/db/sqlite/driver";
import { sql } from "drizzle-orm";

const version = "1.17.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        db.run(sql`
            CREATE TABLE "resourceHeaderToken" (
                "headerTokenId" text PRIMARY KEY NOT NULL,
                "orgId" text NOT NULL REFERENCES "orgs"("orgId") ON DELETE CASCADE,
                "resourceId" integer NOT NULL REFERENCES "resources"("resourceId") ON DELETE CASCADE,
                "tokenHash" text NOT NULL,
                "title" text,
                "expiresAt" integer,
                "createdAt" integer NOT NULL
            );
        `);

        db.run(
            sql`ALTER TABLE "resources" ADD COLUMN "headerTokenHeaderName" text;`
        );

        console.log("Migrated database");
    } catch (e) {
        console.log("Unable to migrate database");
        console.log(e);
        throw e;
    }

    console.log(`${version} migration complete`);
}
