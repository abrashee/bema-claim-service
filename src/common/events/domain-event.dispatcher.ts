import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * DOMAIN EVENT DISPATCHER
 *
 * This is the ONLY allowed way to emit domain events.
 * It decouples domain layer from infrastructure (EventEmitter2).
 */
@Injectable()
export class DomainEventDispatcher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit<T>(event: string, payload: T): void {
    this.eventEmitter.emit(event, payload);
  }
}
