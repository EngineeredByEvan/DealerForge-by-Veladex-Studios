import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { TenancyMiddleware } from './common/middleware/tenancy.middleware';

@Module({
  imports: [HealthModule]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenancyMiddleware)
      .exclude({ path: 'api/v1/health', method: RequestMethod.GET })
      .forRoutes('*');
  }
}
