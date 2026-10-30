import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { Public } from '../auth/decorators/public.decorator';
import { LICENSE_CODE, LICENSE_MAX_FILE_BYTES } from './license.constants';
import { LicenseError, LicenseService } from './license.service';
import type { LicenseStatus } from './license.types';

/**
 * Offline license endpoints (Unified License Platform v1).
 *
 * These endpoints are recovery paths: they stay reachable even when the
 * license is invalid, otherwise a customer could never upload a new license.
 */
@Controller('api/license')
@Public()
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('status')
  status(): LicenseStatus {
    return this.licenseService.status();
  }

  @Get('machine-code')
  machineCode(): Record<string, unknown> {
    const machineCode = this.licenseService.machineCode();
    return {
      code: LICENSE_CODE.ok,
      valid: true,
      message: '',
      machine_code: machineCode,
      data: { machine_code: machineCode },
    };
  }

  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file?: Express.Multer.File): LicenseStatus {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('请选择要上传的授权文件（表单字段名应为 file）');
    }
    if (file.buffer.length > LICENSE_MAX_FILE_BYTES) {
      throw new BadRequestException('授权文件过大，请确认上传的是 .lic 授权文件');
    }
    try {
      return this.licenseService.install(file.buffer);
    } catch (error) {
      if (error instanceof LicenseError) {
        // HTTP 200 + success code so the frontend can display the exact reason.
        return {
          code: error.code,
          valid: false,
          message: `授权文件校验失败: ${error.message}`,
          in_grace: false,
          remaining_days: 0,
          checked_at: new Date().toISOString(),
          license: null,
        };
      }
      throw error;
    }
  }

  @Post('reload')
  @HttpCode(200)
  reload(): LicenseStatus {
    return this.licenseService.reload();
  }
}
