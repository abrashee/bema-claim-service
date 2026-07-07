// src app.module.ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ClaimModule } from "./claim/claim.module";
import { LoggingModule } from "./common/logging/logging.module";
import { DatabaseModule } from "./common/database/database.module";
import { ObservabilityModule } from "./common/observability/observability.module";
import { DomainEventModule } from "./common/events/domain-event.module";

@Module({
  imports: [
    ClaimModule,
    LoggingModule,
    DatabaseModule,
    ObservabilityModule,
    DomainEventModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
