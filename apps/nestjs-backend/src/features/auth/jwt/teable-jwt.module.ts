import { Global, Module } from '@nestjs/common';
import { TableJwtService } from './teable-jwt.service';

@Global()
@Module({
  providers: [TableJwtService],
  exports: [TableJwtService],
})
export class TableJwtModule {}
