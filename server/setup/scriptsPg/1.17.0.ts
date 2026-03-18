import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";

const version = "1.17.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        await db.execute(sql`BEGIN`);

        await db.execute(sql`
            CREATE TABLE "resourceHeaderToken" (
                "headerTokenId" varchar PRIMARY KEY NOT NULL,
                "orgId" varchar NOT NULL REFERENCES "orgs"("orgId") ON DELETE CASCADE,
                "resourceId" integer NOT NULL REFERENCES "resources"("resourceId") ON DELETE CASCADE,
                "tokenHash" varchar NOT NULL,
                "title" varchar,
                "expiresAt" bigint,
                "createdAt" bigint NOT NULL
            );
        `);

        await db.execute(
            sql`ALTER TABLE "resources" ADD COLUMN "headerTokenHeaderName" varchar;`
        );

        await db.execute(sql`COMMIT`);
        console.log("Migrated database");
    } catch (e) {
        await db.execute(sql`ROLLBACK`);
        console.log("Unable to migrate database");
        console.log(e);
        throw e;
    }

    console.log(`${version} migration complete`);
}
