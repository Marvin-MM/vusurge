export interface ScanResult {
  readonly clean: boolean
  readonly signature: string | null
}

export interface FileScanner {
  readonly available: boolean
  scan(bytes: Uint8Array): Promise<ScanResult>
  healthCheck(): Promise<boolean>
}
