import { featureDisabled } from '../errors'
import type { FileScanner } from './file-scanner'

export class NullFileScanner implements FileScanner {
  readonly available = false

  async scan(): Promise<never> {
    throw featureDisabled('document_uploads')
  }

  async healthCheck(): Promise<boolean> {
    return false
  }
}
