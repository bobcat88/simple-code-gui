
export interface TokenStatsResponse {
  totalTokens: number
  totalCost: number
  [key: string]: unknown
}


export interface ExtensionRegistryResponse {
  extensions: unknown[]
  [key: string]: unknown
}

export interface ProjectScanResponse {
  projectPath: string
  capabilities: unknown
  [key: string]: unknown
}

export interface InitializationProposalResponse {
  id: string
  operations: unknown[]
  [key: string]: unknown
}

export interface ProjectIntelligenceResponse {
  health: number
  [key: string]: unknown
}

export interface CheckToolResponse {
  installed: boolean
  version?: string
  path?: string
  error?: string
}

export interface VoiceCheckResponse {
  installed: boolean
  engine?: string
  error?: string
}
