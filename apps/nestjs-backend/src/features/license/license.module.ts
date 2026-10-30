import { Global, Module } from '@nestjs/common';

import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';

/**
 * Global so both the HTTP middleware bootstrap and the WebSocket gateway can
 * resolve the same LicenseService instance.
 */
@Global()
@Module({
  controllers: [LicenseController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}
