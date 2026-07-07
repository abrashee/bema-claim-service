// src/common/events/claim.events.ts
import { ClaimStatus } from "../../claim/enums/claim-status.enum";

export const CLAIM_EVENTS = {
  STATUS_CHANGED: "claim.status_changed",
  CREATED: "claim.created",
} as const;

export interface ClaimStatusChangedEvent {
  claimId: string;
  status: ClaimStatus;
  updatedAt: Date;
  traceId: string | undefined;
}
