import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ClaimService } from "./claims.service";
import { ClaimStatus } from "./enums/claim-status.enum";

describe("ClaimService", () => {
  const prisma = {
    claim: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  const queue = {
    add: jest.fn(),
    queueSize: jest.fn(),
    incrementRetry: jest.fn(),
    canRetry: jest.fn(),
    requeue: jest.fn(),
    moveToDLQ: jest.fn(),
    clearPending: jest.fn(),
  } as any;

  const rateLimit = {
    assertCreateAllowed: jest.fn(),
  } as any;

  const idempotency = {
    buildKey: jest.fn(),
    claimExistingClaimId: jest.fn(),
    acquirePendingLock: jest.fn(),
    waitForCompletion: jest.fn(),
    finalize: jest.fn(),
    release: jest.fn(),
  } as any;

  const claimService = new ClaimService(
    { log: jest.fn() } as any,
    {
      claimFailuresTotal: { inc: jest.fn() },
      claimProcessingDuration: { observe: jest.fn() },
    } as any,
    queue,
    { emit: jest.fn() } as any,
    prisma,
    rateLimit,
    idempotency,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimit.assertCreateAllowed.mockResolvedValue(undefined);
    idempotency.buildKey.mockReturnValue("claims:idempotency:user-1:key");
    idempotency.claimExistingClaimId.mockResolvedValue(null);
    idempotency.acquirePendingLock.mockResolvedValue(true);
    idempotency.waitForCompletion.mockResolvedValue(null);
    idempotency.finalize.mockResolvedValue(undefined);
    idempotency.release.mockResolvedValue(undefined);
    queue.queueSize.mockResolvedValue(0);
  });

  it("returns an existing claim for the same identity", async () => {
    idempotency.claimExistingClaimId.mockResolvedValueOnce("claim-1");
    prisma.claim.findFirst.mockResolvedValueOnce({
      id: "claim-1",
      identityId: "user-1",
    });

    await expect(
      claimService.createClaim("user-1", {
        description: "A valid claim description",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ id: "claim-1" }),
      }),
    );
  });

  it("rejects access to another user claim", async () => {
    prisma.claim.findFirst.mockResolvedValueOnce(null);

    await expect(
      claimService.getClaim("claim-1", "user-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("enforces valid status transitions", async () => {
    prisma.claim.findUnique.mockResolvedValueOnce({
      id: "claim-1",
      status: ClaimStatus.APPROVED,
      version: 1,
    });

    await expect(
      claimService.updateClaimStatus("claim-1", ClaimStatus.PROCESSING),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
