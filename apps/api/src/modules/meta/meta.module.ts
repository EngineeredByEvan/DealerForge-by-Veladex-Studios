import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { MetaController } from './meta.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MetaController]
})
export class MetaModule {}
