import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, PrismaService]
})
export class LeadsModule {}
