import React from 'react'

export interface ParsedConnectionUrl {
  host: string
  hosts?: string[]
  port: number
  token: string
  nonce?: string
  fingerprint?: string
  nonceExpires?: number
  version?: number
}

export interface QRScannerProps {
  onScan: (data: ParsedConnectionUrl) => void
  onCancel: () => void
  onError: (error: string) => void
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onCancel, onError }) => {
  return (
    <div className="p-4 text-center">
      <p>QR Scanner not supported in this environment.</p>
      <div className="flex gap-4 justify-center mt-4">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
      </div>
    </div>
  )
}

export default QRScanner

