import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PlatformOrDealershipAdminGuard } from '../../common/guards/platform-or-dealership-admin.guard';
import { DealershipSettingsController } from './dealership-settings.controller';
import { DealershipsController } from './dealerships.controller';
import { DealershipsService } from './dealerships.service';

@Module({
  imports: [PrismaModule],
  controllers: [DealershipsController, DealershipSettingsController],
  providers: [DealershipsService, PlatformOrDealershipAdminGuard]
})
export class DealershipsModule {}
