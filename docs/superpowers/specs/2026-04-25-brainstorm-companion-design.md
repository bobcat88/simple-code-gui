# Design Spec: Brainstorm Companion (Requirement Foundry)

## Overview
The **Brainstorm Companion** is a dedicated ideation and specification workspace integrated into the **Project Intelligence Sidebar**. It bridges the gap between raw developer thoughts (seeds) and formal project requirements (KSpec/Beads) through a clean, tabbed interface.

## 1. Integration & Layout
- **Location**: A new tab in the `IntelligenceSidebar` component (alongside "Repo Metrics" and "Swarm Intelligence").
- **Visual Style**: Glassmorphic, density-optimized sidebar UI.
- **Layout**: **Tabbed Sub-view** within the Brainstorm tab:
    - **Tab 1: Ideas (The Foundry)**: A list of quick-capture "Seeds" (integrated with GSD plant-seed).
    - **Tab 2: Drafts (The Spec)**: A real-time visual editor for drafting KSpec modules and acceptance criteria.

## 2. Core Features
- **Seed Capture**: A text input field at the top of the "Ideas" tab to quickly record thoughts.
- **Live Spec Drafting**: A structured editor for YAML-based KSpec modules.
    - **Live Preview**: Visual representation of the spec structure (Parent modules, ACs, Traits).
    - **Validation**: Background validation against the KSpec JSON schema.
- **Native KSpec Sync**: Drafts are automatically written to `.kspec/modules/` (or a dedicated `drafts/` subfolder) with atomic shadow-branch commits.
- **One-Click Promotion**: A button to turn a "Seed" into a "Spec Draft" or a "Beads Task".

## 3. Data Flow & Ownership
- **Owner**: **KSpec** acts as the primary synchronization target.
- **Persistence**: All brainstorm data persists in the `.kspec/` shadow branch, ensuring it doesn't clutter the main code history but remains visible to agents.
- **IPC Layer**:
    - `gsdListSeeds`: Fetches existing seeds from the execution engine.
    - `kspecWriteDraft`: Sends drafted spec updates to the Rust backend for persistence.
    - `bdCreateTask`: IPC bridge to Beads CLI for promoting ideas to tasks.

## 4. UI Components
- `BrainstormTab.tsx`: Main container within the sidebar.
- `IdeaInbox.tsx`: Component for managing GSD seeds and quick todos.
- `SpecDraftEditor.tsx`: High-fidelity editor for KSpec requirements.
- `PromotionWorkflow.tsx`: UI for the "Idea -> Spec -> Task" conversion.

## 5. Success Criteria
- [ ] Users can capture an idea in < 3 seconds.
- [ ] Users can draft a valid KSpec module without manually editing YAML.
- [ ] Brainstorm data persists across application restarts via the shadow branch.
- [ ] "Promote to Task" successfully creates a Beads issue and links it to the spec.
