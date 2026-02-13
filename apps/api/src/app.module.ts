import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PlatformAdminGuard } from './common/guards/platform-admin.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { LeadsModule } from './modules/leads/leads.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { DealershipsModule } from './modules/dealerships/dealerships.module';
import { TeamModule } from './modules/team/team.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CommunicationsModule } from './modules/communications/communications.module';

@Module({
  imports: [
    JwtModule.register({}),
    PrismaModule,
    HealthModule,
    AuthModule,
    LeadsModule,
    TasksModule,
    AppointmentsModule,
    ReportsModule,
    AdminModule,
    IntegrationsModule,
    AiModule,
    AuditModule,
    DealershipsModule,
    TeamModule,
    CommunicationsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard
    },
    {
      provide: APP_GUARD,
      useClass: PlatformAdminGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ]
})
export class AppModule {}
