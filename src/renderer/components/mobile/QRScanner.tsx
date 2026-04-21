import React from 'react'

export interface QRScannerProps {
  onScan: (data: string) => void
  onClose: () => void
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  return (
    <div className="p-4 text-center">
      <p>QR Scanner not supported in this environment.</p>
      <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded">Close</button>
    </div>
  )
}

export default QRScanner
