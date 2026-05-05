import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from './workspace'
import { clearProjectCaches } from '../utils/lruCache'

vi.mock('../utils/lruCache', () => ({
  clearProjectCaches: vi.fn(),
}))

beforeEach(() => {
  useWorkspaceStore.setState({
    projects: [],
    openTabs: [],
    activeTabId: null,
    categories: [],
  })
  vi.clearAllMocks()
})

describe('useWorkspaceStore', () => {
  it('adds, updates, touches, and removes projects while clearing caches', () => {
    const store = useWorkspaceStore.getState()

    store.addProject({ path: '/repo/a', name: 'A' })
    store.addProject({ path: '/repo/a', name: 'Duplicate' })
    expect(useWorkspaceStore.getState().projects).toHaveLength(1)

    store.updateProject('/repo/a', { backend: 'codex', apiPort: 1420 })
    expect(useWorkspaceStore.getState().projects[0]).toMatchObject({ backend: 'codex', apiPort: 1420 })

    store.touchProject('/repo/a')
    expect(useWorkspaceStore.getState().projects[0].lastAccessedAt).toEqual(expect.any(Number))

    store.removeProject('/repo/a')
    expect(clearProjectCaches).toHaveBeenCalledWith('/repo/a')
    expect(useWorkspaceStore.getState().projects).toEqual([])
  })

  it('manages tab activity when tabs open, update, close, and clear', () => {
    const store = useWorkspaceStore.getState()

    store.addTab({ id: 't1', projectPath: '/repo/a', title: 'A', ptyId: 'p1' })
    store.addTab({ id: 't2', projectPath: '/repo/b', title: 'B', ptyId: 'p2' })
    expect(useWorkspaceStore.getState().activeTabId).toBe('t2')

    store.setActiveTab('t1')
    store.updateTab('t1', { customTitle: true, title: 'Custom A' })
    expect(useWorkspaceStore.getState().openTabs[0].title).toBe('Custom A')

    store.removeTab('t1')
    expect(useWorkspaceStore.getState().activeTabId).toBe('t2')

    store.removeTab('t2')
    expect(useWorkspaceStore.getState().activeTabId).toBeNull()

    store.addTab({ id: 't3', projectPath: '/repo/c', title: 'C', ptyId: 'p3' })
    store.clearTabs()
    expect(useWorkspaceStore.getState().openTabs).toEqual([])
  })

  it('organizes categories and project order for sidebar UX', () => {
    const store = useWorkspaceStore.getState()

    const alpha = store.addCategory('Alpha')
    const beta = store.addCategory('Beta')
    store.updateCategory(alpha, { collapsed: true })
    expect(useWorkspaceStore.getState().categories[0]).toMatchObject({ id: alpha, collapsed: true, order: 0 })

    store.reorderCategories([beta, alpha])
    expect(useWorkspaceStore.getState().categories.map(category => category.order)).toEqual([1, 0])

    store.setProjects([
      { path: '/repo/a', name: 'A', categoryId: alpha, order: 0 },
      { path: '/repo/b', name: 'B', categoryId: alpha, order: 1 },
      { path: '/repo/c', name: 'C' },
    ])
    store.moveProjectToCategory('/repo/c', alpha)
    expect(useWorkspaceStore.getState().projects.find(project => project.path === '/repo/c')).toMatchObject({
      categoryId: alpha,
      order: 2,
    })

    store.reorderProjects(alpha, ['/repo/c', '/repo/a', '/repo/b'])
    expect(useWorkspaceStore.getState().projects.map(project => project.order)).toEqual([1, 2, 0])

    store.removeCategory(alpha)
    expect(useWorkspaceStore.getState().categories).toHaveLength(1)
    expect(useWorkspaceStore.getState().projects.every(project => project.categoryId === undefined)).toBe(true)
  })
})
