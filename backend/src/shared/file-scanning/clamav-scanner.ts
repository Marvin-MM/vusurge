import { connect } from 'node:net'
import type { FileScanner, ScanResult } from './file-scanner'

function frame(bytes: Uint8Array): Buffer {
  const length = Buffer.allocUnsafe(4)
  length.writeUInt32BE(bytes.byteLength)
  return Buffer.concat([length, Buffer.from(bytes), Buffer.alloc(4)])
}

export class ClamAvFileScanner implements FileScanner {
  readonly available = true

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number,
  ) {}

  scan(bytes: Uint8Array): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: this.host, port: this.port })
      const chunks: Buffer[] = []
      let settled = false
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        socket.destroy()
        reject(error)
      }
      const finish = (result: ScanResult) => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(result)
      }
      socket.setTimeout(this.timeoutMs, () => fail(new Error('ClamAV scan timed out.')))
      socket.once('error', fail)
      socket.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk))
        const response = Buffer.concat(chunks).toString('utf8')
        if (!response.includes('\0')) return
        const normalized = response.replaceAll('\0', '').trim()
        if (normalized.endsWith('OK')) return finish({ clean: true, signature: null })
        const match = normalized.match(/stream:\s+(.+)\s+FOUND$/)
        if (match !== null) return finish({ clean: false, signature: match[1] ?? 'malware' })
        fail(new Error(`ClamAV returned an unrecognized response: ${normalized.slice(0, 200)}`))
      })
      socket.once('connect', () => {
        socket.write('zINSTREAM\0')
        socket.write(frame(bytes))
      })
      socket.once('close', () => {
        if (!settled) fail(new Error('ClamAV closed the connection without a scan result.'))
      })
    })
  }

  healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ host: this.host, port: this.port })
      let settled = false
      const finish = (healthy: boolean) => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(healthy)
      }
      socket.setTimeout(this.timeoutMs, () => finish(false))
      socket.on('error', () => finish(false))
      socket.on('data', (chunk) => {
        if (Buffer.from(chunk).toString('utf8').includes('PONG')) finish(true)
      })
      socket.on('connect', () => socket.write('zPING\0'))
      socket.on('close', () => finish(false))
    })
  }
}
