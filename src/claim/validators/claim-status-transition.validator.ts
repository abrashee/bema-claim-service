// src / claim / validators / claim-status-transition.validator.ts
import { ClaimStatus } from "../enums/claim-status.enum";
import { BadRequestException } from "@nestjs/common";

/**
 * SINGLE SOURCE OF TRUTH FOR CLAIM LIFECYCLE
 *
 * RULES:
 * - All transitions MUST pass through here
 * - No service is allowed to define its own rules
 * - Any invalid transition throws immediately
 */
export class ClaimStatusTransitionValidator {
  private static readonly transitions: Record<ClaimStatus, ClaimStatus[]> = {
    [ClaimStatus.PENDING]: [ClaimStatus.PROCESSING],

    [ClaimStatus.PROCESSING]: [
      ClaimStatus.FRAUD_CHECKING,
      ClaimStatus.REJECTED, // allow early fail-safe
    ],

    [ClaimStatus.FRAUD_CHECKING]: [ClaimStatus.APPROVED, ClaimStatus.REJECTED],

    [ClaimStatus.APPROVED]: [],
    [ClaimStatus.REJECTED]: [],
  };

  static validate(current: ClaimStatus, next: ClaimStatus): void {
    const allowed = this.transitions[current];

    if (!allowed) {
      throw new BadRequestException(`Invalid current state: ${current}`);
    }

    const isAllowed = allowed.includes(next);

    if (!isAllowed) {
      throw new BadRequestException(
        `Invalid claim state transition: ${current} -> ${next}`,
      );
    }
  }

  /**
   * Optional helper for debugging / observability
   */
  static getAllowedTransitions(state: ClaimStatus): ClaimStatus[] {
    return this.transitions[state] ?? [];
  }
}
