import type { NextFunction, Request, Response } from 'express';

import {
  LICENSE_CODE,
  LICENSE_GUARDED_PREFIXES,
  LICENSE_RECOVERY_PREFIXES,
} from './license.constants';
import type { LicenseService } from './license.service';

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function matchesRecovery(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Gate business endpoints when the license is invalid, while always keeping
 * the recovery paths (license APIs, health, auth, settings) reachable.
 *
 * Registered as plain Express middleware so it also covers WebSocket/SockJS
 * handshake requests (`/sockjs`) which never pass through Nest guards.
 */
export function createLicenseMiddleware(licenseService: LicenseService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path;
    if (!matchesPrefix(path, LICENSE_GUARDED_PREFIXES)) {
      next();
      return;
    }
    if (matchesRecovery(path, LICENSE_RECOVERY_PREFIXES)) {
      next();
      return;
    }

    const status = licenseService.status();
    if (status.code === LICENSE_CODE.notInit || status.code === LICENSE_CODE.noPublicKey) {
      res.status(503).json({
        code: status.code,
        valid: false,
        message: status.message,
        in_grace: false,
        remaining_days: 0,
      });
      return;
    }
    if (!status.valid) {
      res.status(403).json({
        code: status.code,
        valid: false,
        message: status.message,
        in_grace: status.in_grace,
        remaining_days: status.remaining_days,
      });
      return;
    }
    next();
  };
}
