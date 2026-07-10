import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { CorrelationContextService } from "./correlation-context.service";
import { CorrelationIdMiddleware } from "./correlation-id.middleware";

@Module({
  providers: [CorrelationContextService, CorrelationIdMiddleware],
  exports: [CorrelationContextService],
})
export class CorrelationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
