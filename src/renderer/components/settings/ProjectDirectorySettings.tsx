import React from 'react'
import { useApi } from '../../contexts/ApiContext'
import type { ExtendedApi } from '../../api/types'

interface ProjectDirectorySettingsProps {
  value: string
  onChange: (dir: string) => void
}

export function ProjectDirectorySettings({ value, onChange }: ProjectDirectorySettingsProps): React.ReactElement {
  const api = useApi() as ExtendedApi

  async function handleSelectDirectory(): Promise<void> {
    const dir = await api?.selectDirectory()
    if (dir) {
      onChange(dir)
    }
  }

  return (
    <div className="form-group">
      <label>Default Project Directory</label>
      <div className="input-with-button">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Select a directory..."
          readOnly
        />
        <button className="browse-btn" onClick={handleSelectDirectory}>
          Browse
        </button>
      </div>
      <p className="form-hint">
        New projects created with "Make Project" will be placed here.
      </p>
    </div>
  )
}
