-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "policyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "correlationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);
