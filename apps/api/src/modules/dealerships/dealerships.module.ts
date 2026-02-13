import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { DealershipsController } from './dealerships.controller';
import { DealershipsService } from './dealerships.service';

@Module({
  imports: [PrismaModule],
  controllers: [DealershipsController],
  providers: [DealershipsService]
})
export class DealershipsModule {}
