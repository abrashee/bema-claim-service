// src app.module.ts
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ClaimModule } from "./claim/claim.module";
import { LoggingModule } from "./common/logging/logging.module";
import { DatabaseModule } from "./common/database/database.module";
import { ObservabilityModule } from "./common/observability/observability.module";
import { DomainEventModule } from "./common/events/domain-event.module";
import { CorrelationModule } from "./common/correlation/correlation.module";
import { GlobalHttpExceptionFilter } from "./common/exceptions/global-http-exception.filter";
import { LoggerService } from "./common/logging/logger.service";

@Module({
  imports: [
    ClaimModule,
    LoggingModule,
    DatabaseModule,
    ObservabilityModule,
    DomainEventModule,
    CorrelationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useFactory: (logger: LoggerService) =>
        new GlobalHttpExceptionFilter(logger),
      inject: [LoggerService],
    },
  ],
})
export class AppModule {}
