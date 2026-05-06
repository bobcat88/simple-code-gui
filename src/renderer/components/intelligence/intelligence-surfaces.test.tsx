import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtendedApi, GsdSeed, KSpecDraft } from '../../api/types';
import { BrainstormCanvas } from './BrainstormCanvas';
import { BrainstormTab } from './BrainstormTab';
import { GovernanceTab } from './GovernanceTab';
import { IdeaInbox } from './IdeaInbox';
import { NeuralHUDTab } from './NeuralHUDTab';
import { SpecDraftEditor } from './SpecDraftEditor';
import { SynapticExpansion } from './SynapticExpansion';
import {
  parseKSpec,
  toYaml,
  validateDraftContent,
} from './specDraftEditorUtils';

interface ForceGraphMockProps {
  graphData: { nodes: Array<{ id: string }>; links: unknown[] };
  onNodeClick?: (node: {
    id: string;
    name: string;
    type: string;
    color: string;
    x: number;
    y: number;
    z: number;
  }) => void;
}

vi.mock('react-force-graph-3d', () => ({
  default: React.forwardRef<
    { cameraPosition: ReturnType<typeof vi.fn> },
    ForceGraphMockProps
  >(({ graphData, onNodeClick }, ref) => {
    React.useImperativeHandle(ref, () => ({ cameraPosition: vi.fn() }));
    return (
      <button
        type="button"
        data-testid="force-graph"
        onClick={() =>
          onNodeClick?.({
            id: 'node-0',
            name: 'Feature Node',
            type: 'feature',
            color: '#ccff00',
            x: 1,
            y: 1,
            z: 1,
          })
        }
      >
        graph {graphData.nodes.length}/{graphData.links.length}
      </button>
    );
  }),
}));

vi.mock('three-spritetext', () => ({
  default: class SpriteText {
    color = '';
    textHeight = 0;
    backgroundColor = '';
    padding = 0;
    borderRadius = 0;
    constructor(public text: string) {}
  },
}));

vi.mock('three', () => ({
  Group: class {
    add = vi.fn();
  },
  SphereGeometry: class {},
  MeshBasicMaterial: class {
    constructor(public options: unknown) {}
  },
  Color: class {
    constructor(public value: string) {}
  },
  Mesh: class {
    constructor(
      public geometry: unknown,
      public material: unknown
    ) {}
  },
}));

vi.mock('../../hooks/useThoughtChain', () => ({
  useThoughtChain: () => ({
    thoughtHistory: [
      {
        timestamp: 1710000000000,
        eventType: 'LEARNING',
        message: 'Self-healing agent learned from failing tests',
      },
    ],
    activeThought: {
      message: 'Pulsing through agent graph',
      nodeIds: ['node-0'],
    },
    highlightNodes: new Set(['node-0']),
  }),
}));

vi.mock('../../contexts/DialogContext', () => ({
  useDialog: () => ({
    showError: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

const seed: GsdSeed = {
  id: 'seed-1',
  slug: 'seed-one',
  title: 'Self healing agent',
  why: 'Repair flaky coverage gaps',
  createdAt: '2026-05-05T10:00:00Z',
  whenToSurface: 'Next Milestone',
  status: 'planted',
} as GsdSeed;

const draftContent = `title: Agent HUD
type: module
status:
  maturity: draft
description: >-
  Keep agent HUD useful.
acceptance_criteria:
  - id: ac-1
    given: |
      active agent
    when: |
      task changes
    then: |
      HUD pulses
`;

const draft: KSpecDraft = {
  id: 'draft-1',
  moduleId: 'agent-hud',
  title: 'Agent HUD',
  content: draftContent,
  updatedAt: '2026-05-05T10:00:00Z',
} as unknown as KSpecDraft;

const makeApi = (overrides: Partial<ExtendedApi> = {}): ExtendedApi =>
  ({
    gsdSwarmQueryMemory: vi.fn(() =>
      Promise.resolve([
        { content: 'Feature memory pattern', type: 'feature' },
        { content: 'Bug repair pattern', type: 'bug' },
      ])
    ),
    gsdQuantumSyncStart: vi.fn(() => Promise.resolve()),
    gsdPlantSeed: vi.fn(() => Promise.resolve()),
    gsdListSeeds: vi.fn(() => Promise.resolve([seed])),
    kspecListDrafts: vi.fn(() => Promise.resolve([draft])),
    brainstormLoadCanvas: vi.fn(() =>
      Promise.resolve({
        nodes: [
          {
            id: 'n1',
            sourceId: 'seed-1',
            nodeType: 'seed',
            title: 'Self healing agent',
            content: 'Repair flaky coverage gaps',
            x: 20,
            y: 20,
            width: 160,
            height: 80,
          },
        ],
        edges: [],
      })
    ),
    brainstormSaveCanvas: vi.fn(() => Promise.resolve()),
    brainstormSaveTopology: vi.fn(() => Promise.resolve({ success: true })),
    brainstormArchitectReview: vi.fn(() =>
      Promise.resolve({
        id: 'review-1',
        sourceId: 'review-1',
        nodeType: 'review',
        title: 'Architect Review',
        content: 'Looks viable',
        x: 0,
        y: 0,
        width: 160,
        height: 80,
      })
    ),
    brainstormAgenticSketch: vi.fn(() =>
      Promise.resolve({
        id: 'sketch-1',
        sourceId: 'sketch-1',
        nodeType: 'sketch',
        title: 'Agentic Sketch',
        content: 'Sketch path',
        x: 0,
        y: 0,
        width: 160,
        height: 80,
      })
    ),
    kspecWriteDraft: vi.fn(() => Promise.resolve()),
    beadsCreate: vi.fn(() => Promise.resolve({ success: true })),
    gsdUpdateSeedStatus: vi.fn(() => Promise.resolve()),
    ...overrides,
  }) as unknown as ExtendedApi;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(() => Promise.resolve()),
    },
  });
});

describe('specDraftEditorUtils', () => {
  it('parses, serializes, and validates KSpec drafts outside the huge editor view', () => {
    const parsed = parseKSpec(draftContent);

    expect(parsed.title).toBe('Agent HUD');
    expect(parsed.acceptance_criteria[0]?.id).toBe('ac-1');
    expect(parsed.acceptance_criteria[0]?.then).toBe('HUD pulses');
    expect(toYaml(parsed)).toContain('acceptance_criteria:');
    expect(validateDraftContent('')).toContain('Draft content is empty.');
    expect(validateDraftContent(draftContent)).toEqual([]);
  });
});

describe('NeuralHUDTab', () => {
  it('renders quantum sync HUD, graph activity, thought bubble, and node detail overlay', async () => {
    const api = makeApi();
    render(<NeuralHUDTab api={api} projectPath="/repo" />);

    expect(screen.getByText('Quantum Sync Active')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('force-graph')).toHaveTextContent('graph 2/1')
    );
    expect(
      screen.getByText('Self-healing agent learned from failing tests')
    ).toBeInTheDocument();
    expect(
      screen.getByText('"Pulsing through agent graph"')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('force-graph'));
    expect(screen.getByText('ACTIVE SYNAPSE')).toBeInTheDocument();
  });
});

describe('IdeaInbox', () => {
  it('plants seeds and routes promotions to drafts/tasks', async () => {
    const api = makeApi();
    const onRefresh = vi.fn();
    const onSeedToDraft = vi.fn();
    const onSeedToTask = vi.fn(() => Promise.resolve());

    render(
      <IdeaInbox
        api={api}
        projectPath="/repo"
        seeds={[seed]}
        loading={false}
        onRefresh={onRefresh}
        onSeedToDraft={onSeedToDraft}
        onSeedToTask={onSeedToTask}
      />
    );

    fireEvent.click(screen.getByText('Plant a new Seed'));
    fireEvent.change(screen.getByPlaceholderText("What's the idea?"), {
      target: { value: 'Token optimizer' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Why is this important? (Optional)'),
      { target: { value: 'Save cost' } }
    );
    fireEvent.click(screen.getByText('Plant Seed'));

    await waitFor(() =>
      expect(api.gsdPlantSeed).toHaveBeenCalledWith(
        '/repo',
        expect.objectContaining({ title: 'Token optimizer' })
      )
    );
    expect(onRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Draft Spec'));
    expect(onSeedToDraft).toHaveBeenCalledWith(seed);

    fireEvent.click(screen.getByText('Promote to Beads'));
    await waitFor(() => expect(onSeedToTask).toHaveBeenCalledWith(seed));
  });
});

describe('SpecDraftEditor', () => {
  it('opens draft, edits form/YAML, validates, saves, and creates new drafts', async () => {
    const api = makeApi();
    const onRefresh = vi.fn();
    render(
      <SpecDraftEditor
        api={api}
        projectPath="/repo"
        drafts={[draft]}
        loading={false}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByText('agent-hud'));
    expect(screen.getByDisplayValue('Agent HUD')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Agent HUD'), {
      target: { value: 'Agent HUD v2' },
    });
    fireEvent.click(screen.getByText('YAML'));
    expect(screen.getByDisplayValue(/Agent HUD v2/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save Draft'));
    await waitFor(() =>
      expect(api.kspecWriteDraft).toHaveBeenCalledWith(
        '/repo',
        'agent-hud',
        expect.stringContaining('Agent HUD v2')
      )
    );

    const draftHeader = screen.getByText('KSpec Drafts').closest('div');
    const newDraftButton = draftHeader?.querySelector('button');
    if (!newDraftButton) throw new Error('New draft button missing');
    fireEvent.click(newDraftButton);
    fireEvent.change(
      screen.getByPlaceholderText('Module ID (e.g. auth-provider)'),
      { target: { value: 'agent-speed' } }
    );
    fireEvent.click(screen.getByText('Create Draft'));
    await waitFor(() =>
      expect(api.kspecWriteDraft).toHaveBeenCalledWith(
        '/repo',
        'agent-speed',
        expect.stringContaining('title: agent-speed')
      )
    );
  });
});

describe('BrainstormTab and BrainstormCanvas', () => {
  it('loads brainstorm data, switches views, promotes seed through dialog, and refreshes', async () => {
    const api = makeApi();
    render(<BrainstormTab api={api} projectPath="/repo" />);

    await waitFor(() => expect(api.gsdListSeeds).toHaveBeenCalledWith('/repo'));
    fireEvent.click(screen.getByText('Spec Drafts'));
    expect(await screen.findByText('agent-hud')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Canvas'));
    expect(await screen.findByText('Self healing agent')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Idea Inbox'));
    fireEvent.click(screen.getByText('Draft Spec'));
    fireEvent.change(screen.getByDisplayValue('Self healing agent'), {
      target: { value: 'Promoted HUD' },
    });
    fireEvent.click(screen.getByText('Create KSpec Draft'));

    await waitFor(() =>
      expect(api.kspecWriteDraft).toHaveBeenCalledWith(
        '/repo',
        expect.any(String),
        expect.stringContaining('Promoted HUD')
      )
    );
  });

  it('adds nodes, exports topology, and invokes agent review/sketch controls', async () => {
    const api = makeApi();
    render(
      <BrainstormCanvas
        api={api}
        projectPath="/repo"
        canvas={{ nodes: [], edges: [] }}
        seeds={[seed]}
        drafts={[draft]}
        onRefresh={vi.fn(() => Promise.resolve())}
        onPromoteToDraft={vi.fn(() => Promise.resolve())}
        onPromoteToTask={vi.fn(() => Promise.resolve())}
      />
    );

    fireEvent.click(screen.getByTitle('Add Seed: Self healing agent'));
    await waitFor(() => expect(api.brainstormSaveCanvas).toHaveBeenCalled());
    expect(screen.getByText('Self healing agent')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Export Topology (Mermaid)'));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    );
    expect(api.brainstormSaveTopology).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Self healing agent'));
    fireEvent.click(screen.getByText('Architect Review'));
    await waitFor(() =>
      expect(api.brainstormArchitectReview).toHaveBeenCalled()
    );
    fireEvent.click(screen.getByText('Agentic Sketch'));
    await waitFor(() => expect(api.brainstormAgenticSketch).toHaveBeenCalled());
  });
});

describe('GovernanceTab', () => {
  it('renders sync controls and responds to manual sync', async () => {
    const api = makeApi({
      gsdGetSyncStatus: vi.fn(() => Promise.resolve(false)),
      gsdSyncMemory: vi.fn(() => Promise.resolve(3)),
      gsdStartAutomaticSync: vi.fn(() => Promise.resolve()),
      gsdStopAutomaticSync: vi.fn(() => Promise.resolve()),
    });
    render(<GovernanceTab api={api} projectPath="/repo" />);

    await waitFor(() => expect(api.gsdGetSyncStatus).toHaveBeenCalled());
    expect(screen.getByText('Quantum Bridge')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sync Now'));
    await waitFor(() => expect(api.gsdSyncMemory).toHaveBeenCalled());
  });
});

describe('SynapticExpansion', () => {
  it('renders sub-tabs and shows MCP node list', async () => {
    const api = makeApi({
      mcpGetServers: vi.fn(() =>
        Promise.resolve([
          { name: 'filesystem', command: 'npx', args: [], env: {} },
          { name: 'remote-node', args: [], env: {}, url: 'http://remote:8080' },
        ])
      ),
      mcpIsNodeTrusted: vi.fn(() => Promise.resolve(false)),
      mcpDiscoverServers: vi.fn(() => Promise.resolve([])),
      registerMcpServer: vi.fn(() => Promise.resolve()),
      mcpTrustNode: vi.fn(() => Promise.resolve()),
      gsdGetSynapticMetrics: vi.fn(() =>
        Promise.resolve({ feedbackLoops: 3, activeOptimizations: 0, cognitiveLoad: 0.4, swarmCohesion: 0.85 })
      ),
      gsdTriggerExpansionLoop: vi.fn(() => Promise.resolve()),
      gsdExecuteProactiveAudit: vi.fn(() => Promise.resolve('audit done')),
    });
    render(<SynapticExpansion api={api} projectPath="/repo" />);

    await waitFor(() => expect(api.mcpGetServers).toHaveBeenCalled());
    expect(screen.getByText('filesystem')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Loops'));
    await waitFor(() => expect(api.gsdGetSynapticMetrics).toHaveBeenCalled());
    expect(screen.getByText('Active Loops')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Architect'));
    expect(screen.getByText('Autonomous Architect')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Borg'));
    expect(screen.getByText('Borg Knowledge Bridge')).toBeInTheDocument();
  });
});
