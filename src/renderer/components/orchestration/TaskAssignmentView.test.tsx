import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TaskAssignmentView } from './TaskAssignmentView'
import { useWorkspaceStore } from '../../stores/workspace.js'

afterEach(() => {
  useWorkspaceStore.setState({
    projects: [],
    openTabs: [],
    activeTabId: null,
    categories: [],
  })
})

describe('TaskAssignmentView', () => {
  it('renders repository and task queues and lets an agent assignment change in place', () => {
    useWorkspaceStore.setState({
      projects: [
        {
          path: '/workspace/alpha',
          name: 'Alpha Repo',
          backend: 'claude',
          color: '#7c3aed',
        },
        {
          path: '/workspace/beta',
          name: 'Beta Repo',
        },
      ],
      openTabs: [
        {
          id: 'tab-1',
          projectPath: '/workspace/alpha',
          title: 'Implement sync flow',
          ptyId: 'pty-1',
          backend: 'claude',
        },
      ],
      activeTabId: 'tab-1',
      categories: [],
    })

    const onOpenSession = vi.fn()

    render(<TaskAssignmentView onOpenSession={onOpenSession} />)

    expect(screen.getByText('Repositories (2)')).toBeInTheDocument()
    expect(screen.getByText('Tasks (1)')).toBeInTheDocument()
    expect(screen.getByText('Alpha Repo')).toBeInTheDocument()
    expect(screen.getByText('Beta Repo')).toBeInTheDocument()
    expect(screen.getByText('Implement sync flow')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /change agent for alpha repo/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Gemini$/ }))

    expect(screen.getByRole('button', { name: /change agent for alpha repo/i })).toHaveTextContent('Gemini')

    fireEvent.click(screen.getByRole('button', { name: /open session for alpha repo/i }))
    expect(onOpenSession).toHaveBeenCalledWith('/workspace/alpha')
  })
})
