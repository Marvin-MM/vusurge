import type { FileScanner, ScanResult } from '../../src/shared/file-scanning'

/**
 * An in-memory malware scanner fake for integration and E2E tests.
 *
 * Accurately detects the industry-standard EICAR test string so malware quarantine
 * workflows can be asserted without depending on an active ClamAV daemon.
 */
export class FakeFileScanner implements FileScanner {
  readonly available = true

  async scan(bytes: Uint8Array): Promise<ScanResult> {
    const text = Buffer.from(bytes).toString('utf8')
    if (text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      return { clean: false, signature: 'Win.Test.EICAR_HDB-1' }
    }
    return { clean: true, signature: null }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}

export function createFakeFileScanner(): FakeFileScanner {
  return new FakeFileScanner()
}
