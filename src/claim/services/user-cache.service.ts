// src / claim / services / user-cache.service.ts
import { Injectable } from "@nestjs/common";

@Injectable()
export class UserCacheService {
  private cache = new Map<string, { valid: boolean; expiresAt: number }>();

  private TTL_MS = 60_000; // 1 minute cache

  set(userId: string, valid: boolean) {
    this.cache.set(userId, {
      valid,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  get(userId: string): boolean | null {
    const entry = this.cache.get(userId);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      return null;
    }

    return entry.valid;
  }

  invalidate(userId: string) {
    this.cache.delete(userId);
  }
}
