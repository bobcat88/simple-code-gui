import { describe, expect, it } from 'vitest';
import type { BrainstormCanvas, GsdSeed, KSpecDraft } from '../../api/types';
import {
  availableBrainstormDrafts,
  availableBrainstormSeeds,
  selectBrainstormNodes,
} from './useBrainstormCanvasModel';

const canvas: BrainstormCanvas = {
  nodes: [
    {
      id: 'n1',
      sourceId: 'seed-1',
      nodeType: 'seed',
      title: 'Seed node',
      content: '',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    },
  ],
  edges: [],
};

describe('useBrainstormCanvasModel helpers', () => {
  it('selects nodes and filters inventory already present on canvas', () => {
    const seeds = [
      { id: 'seed-1', title: 'Existing' },
      { id: 'seed-2', title: 'New' },
    ] as GsdSeed[];
    const drafts = [
      { id: 'draft-1', title: 'Draft A' },
      { id: 'seed-1', title: 'Draft collision' },
    ] as KSpecDraft[];

    expect(selectBrainstormNodes(canvas, ['n1'])).toHaveLength(1);
    expect(
      availableBrainstormSeeds(seeds, canvas).map((seed) => seed.id)
    ).toEqual(['seed-2']);
    expect(
      availableBrainstormDrafts(drafts, canvas).map((draft) => draft.id)
    ).toEqual(['draft-1']);
  });
});
