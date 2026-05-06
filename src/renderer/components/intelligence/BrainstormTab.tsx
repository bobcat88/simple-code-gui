import { FileEdit, Lightbulb, Network, RefreshCw } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type {
  BrainstormCanvas as BrainstormCanvasData,
  ExtendedApi,
  GsdSeed,
  KSpecDraft,
} from '../../api/types';
import { cn } from '../../lib/utils';
import { IdeaInbox } from './IdeaInbox';
import { PromotionDialog } from './PromotionDialog';
import { SpecDraftEditor } from './SpecDraftEditor';

const BrainstormCanvas = lazy(() =>
  import('./BrainstormCanvas').then((module) => ({
    default: module.BrainstormCanvas,
  }))
);

interface BrainstormTabProps {
  api: ExtendedApi;
  projectPath: string;
}

type BrainstormView = 'inbox' | 'drafts' | 'canvas';

export function BrainstormTab({ api, projectPath }: BrainstormTabProps) {
  const [activeView, setActiveView] = useState<BrainstormView>('inbox');
  const [seeds, setSeeds] = useState<GsdSeed[]>([]);
  const [drafts, setDrafts] = useState<KSpecDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [canvas, setCanvas] = useState<BrainstormCanvasData>({
    nodes: [],
    edges: [],
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSeedForPromotion, setSelectedSeedForPromotion] =
    useState<GsdSeed | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      const [s, d, loadedCanvas] = await Promise.all([
        api.gsdListSeeds(projectPath),
        api.kspecListDrafts(projectPath),
        api.brainstormLoadCanvas(projectPath),
      ]);
      setSeeds(s);
      setDrafts(d);
      setCanvas({
        nodes: loadedCanvas.nodes || [],
        edges: loadedCanvas.edges || [],
        updatedAt: loadedCanvas.updatedAt,
      });
    } catch (err) {
      console.error('Failed to refresh brainstorm data:', err);
      setErrorMessage('Failed to load brainstorm data.');
    } finally {
      setLoading(false);
    }
  }, [api, projectPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSeedPromotionRequest = (seed: GsdSeed) => {
    setSelectedSeedForPromotion(seed);
  };

  const executePromotion = async (
    type: 'draft' | 'task',
    title: string,
    why: string
  ) => {
    if (!selectedSeedForPromotion) return;
    setIsPromoting(true);
    const seed = selectedSeedForPromotion;

    try {
      if (type === 'draft') {
        const moduleId =
          (seed.slug || title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'brainstorm-seed';
        const content = `title: ${title}\ntype: module\nstatus:\n  maturity: draft\ndescription: ${why || 'Draft created from a brainstorm seed.'}\nacceptance_criteria:\n  - id: ac-1\n    given: ${title}\n    when: this seed is promoted into implementation work\n    then: the desired outcome is specified and testable\n`;
        await api.kspecWriteDraft(projectPath, moduleId, content);

        if (seed.slug) {
          await api.gsdUpdateSeedStatus?.(
            projectPath,
            seed.slug,
            'promoted_to_draft'
          );
        }
        setActiveView('drafts');
      } else {
        const description = [
          why
            ? `Seed rationale: ${why}`
            : 'Created from a Brainstorm Companion seed.',
          `When to surface: ${seed.whenToSurface || 'Next Milestone'}`,
          `Source seed: ${seed.slug || seed.id || seed.title}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        await api.beadsCreate(
          projectPath,
          title,
          description,
          2,
          'task',
          'brainstorm,seed'
        );

        if (seed.slug) {
          await api.gsdUpdateSeedStatus?.(
            projectPath,
            seed.slug,
            'promoted_to_task'
          );
        }
      }

      await refresh();
      setSelectedSeedForPromotion(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : `Failed to promote seed to ${type}.`
      );
    } finally {
      setIsPromoting(false);
    }
  };

  const handleSeedToDraft = async (seed: GsdSeed) => {
    // Legacy direct handler - now just sets the type in the dialog if needed,
    // but we'll just open the dialog for now.
    handleSeedPromotionRequest(seed);
  };

  const handleSeedToTask = async (seed: GsdSeed) => {
    handleSeedPromotionRequest(seed);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 bg-codex-obsidian/40 rounded-xl border border-white/5 shadow-inner backdrop-blur-md">
        <button
          type="button"
          onClick={() => setActiveView('inbox')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300',
            activeView === 'inbox'
              ? 'bg-codex-blue/10 text-codex-blue border border-codex-blue/30 shadow-blue-sm'
              : 'text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent'
          )}
        >
          <Lightbulb size={12} />
          Idea Inbox
        </button>
        <button
          type="button"
          onClick={() => setActiveView('drafts')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300',
            activeView === 'drafts'
              ? 'bg-codex-blue/10 text-codex-blue border border-codex-blue/30 shadow-blue-sm'
              : 'text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent'
          )}
        >
          <FileEdit size={12} />
          Spec Drafts
        </button>
        <button
          type="button"
          onClick={() => setActiveView('canvas')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300',
            activeView === 'canvas'
              ? 'bg-codex-emerald/10 text-codex-emerald border border-codex-emerald/30 shadow-emerald-sm'
              : 'text-white/30 hover:text-white/60 hover:bg-white/5 border border-transparent'
          )}
        >
          <Network size={12} />
          Canvas
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 pb-4">
        {errorMessage && (
          <div className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2 animate-in slide-in-from-top-1 duration-200">
            {errorMessage}
          </div>
        )}

        {activeView === 'inbox' && (
          <IdeaInbox
            api={api}
            projectPath={projectPath}
            seeds={seeds}
            loading={loading}
            onRefresh={refresh}
            onSeedToDraft={handleSeedToDraft}
            onSeedToTask={handleSeedToTask}
          />
        )}

        {activeView === 'drafts' && (
          <SpecDraftEditor
            api={api}
            projectPath={projectPath}
            drafts={drafts}
            loading={loading}
            onRefresh={refresh}
          />
        )}

        {activeView === 'canvas' && (
          <Suspense
            fallback={
              <div className="h-[500px] rounded-2xl border border-white/5 bg-black/20 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-white/30 animate-pulse">
                Loading canvas...
              </div>
            }
          >
            <BrainstormCanvas
              api={api}
              projectPath={projectPath}
              canvas={canvas}
              seeds={seeds}
              drafts={drafts}
              onRefresh={refresh}
              onPromoteToDraft={handleSeedToDraft}
              onPromoteToTask={handleSeedToTask}
            />
          </Suspense>
        )}
      </div>

      {/* Footer / Status */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              loading
                ? 'bg-white/20 animate-pulse'
                : 'bg-codex-emerald shadow-emerald-sm'
            )}
          />
          <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold">
            {loading ? 'Syncing...' : 'Synchronized'}
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="p-1 hover:bg-codex-blue/10 rounded-lg text-white/20 hover:text-codex-blue transition-all border border-transparent hover:border-codex-blue/20"
        >
          <RefreshCw size={12} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Promotion Dialog */}
      {selectedSeedForPromotion && (
        <PromotionDialog
          seed={selectedSeedForPromotion}
          isPromoting={isPromoting}
          onClose={() => setSelectedSeedForPromotion(null)}
          onPromote={executePromotion}
        />
      )}
    </div>
  );
}
