// src/common/events/domain-event.module.ts
import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { DomainEventDispatcher } from "./domain-event.dispatcher";

/**
 * LOCAL EVENT BUS ONLY
 *
 * WARNING:
 * This is NOT a message broker.
 * Do not use for cross-service communication.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: ".",
      maxListeners: 20,
    }),
  ],
  providers: [DomainEventDispatcher],
  exports: [EventEmitterModule, DomainEventDispatcher],
})
export class DomainEventModule {}
