ALTER TABLE "claims"
ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "claims_identityId_created_at_idx"
ON "claims" ("identityId", "created_at");
