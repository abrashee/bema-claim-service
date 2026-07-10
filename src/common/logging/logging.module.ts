// src/common/logging/logging.module.ts
import { Module } from "@nestjs/common";
import { LoggerService } from "./logger.service";
import { CorrelationModule } from "../correlation/correlation.module";

@Module({
  imports: [CorrelationModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggingModule {}
