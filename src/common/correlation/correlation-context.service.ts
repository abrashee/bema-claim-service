import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";

type CorrelationContext = {
  correlationId: string;
};

@Injectable()
export class CorrelationContextService {
  private readonly storage = new AsyncLocalStorage<CorrelationContext>();

  run<T>(correlationId: string, callback: () => T): T {
    return this.storage.run({ correlationId }, callback);
  }

  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }
}
