import type { AppConfig } from '../config/config.schema'
import { ClamAvFileScanner } from './clamav-scanner'
import type { FileScanner } from './file-scanner'
import { NullFileScanner } from './null-scanner'

export type { FileScanner, ScanResult } from './file-scanner'

export function createFileScanner(config: AppConfig): FileScanner {
  return config.malwareScanner.enabled
    ? new ClamAvFileScanner(
        config.malwareScanner.host,
        config.malwareScanner.port,
        config.malwareScanner.timeoutMs,
      )
    : new NullFileScanner()
}
