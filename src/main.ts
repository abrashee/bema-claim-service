import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { loadClaimServiceConfig } from "./common/config/service-config";
import { LoggerService } from "./common/logging/logger.service";

async function bootstrap() {
  const config = loadClaimServiceConfig();


  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  app.useLogger(app.get(LoggerService));
  app.flushLogs();
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.disable("x-powered-by");
  expressApp.use(json({ limit: config.requestBodyLimit }));
  expressApp.use(
    urlencoded({ extended: false, limit: config.requestBodyLimit }),
  );
  expressApp.use((_, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    response.setHeader("Cross-Origin-Resource-Policy", "same-site");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    if (config.nodeEnv === "production") {
      response.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }

    next();
  });

  await app.listen(config.port, "0.0.0.0");
}

void bootstrap();
