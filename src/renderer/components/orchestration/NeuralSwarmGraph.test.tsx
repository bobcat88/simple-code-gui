import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NeuralSwarmGraph } from './NeuralSwarmGraph'
import type { AgentMessage } from '../../hooks/useSwarmMessages'

const makeMessage = (id: string, message_type: AgentMessage['message_type']): AgentMessage => ({
  id,
  from_agent: 'planner',
  to_agent: 'builder',
  message_type,
  content: `${message_type} payload`,
  timestamp: 1710000000000,
})

describe('NeuralSwarmGraph', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders glowing neural nodes, links, and pulsing activity for recent agent messages', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const messages = [
      makeMessage('m1', 'finding'),
      makeMessage('m2', 'warning'),
      makeMessage('m3', 'alert'),
    ]

    const { container } = render(<NeuralSwarmGraph messages={messages} />)

    expect(container.querySelector('filter#glow')).toBeInTheDocument()
    expect(container.querySelector('linearGradient#linkGradient')).toBeInTheDocument()
    expect(container.querySelectorAll('line')).toHaveLength(2)
    expect(container.querySelectorAll('circle')).toHaveLength(4)
    expect(container.querySelector('circle[fill="#ccff00"]')).toBeInTheDocument()
    expect(container.querySelector('circle[fill="#f59e0b"]')).toBeInTheDocument()
    expect(container.querySelector('circle[fill="#ff0055"]')).toBeInTheDocument()
  })

  it('limits on-screen nodes to the latest 15 messages to keep HUD usable', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const messages = Array.from({ length: 20 }, (_, index) =>
      makeMessage(`m${index}`, index % 2 === 0 ? 'request' : 'simulation')
    )

    const { container } = render(<NeuralSwarmGraph messages={messages} />)

    expect(container.querySelectorAll('line')).toHaveLength(14)
    expect(container.querySelectorAll('circle')).toHaveLength(16)
  })
})
