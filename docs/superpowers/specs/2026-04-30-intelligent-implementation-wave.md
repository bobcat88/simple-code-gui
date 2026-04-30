# Design Spec: Phase 27 - Intelligent Implementation Wave (Neural Swarm)

**Date**: 2026-04-30
**Status**: Draft
**Topic**: Intelligent Implementation Wave with Neural Swarm HUD and Game-Feel

## 1. Executive Summary
Phase 27 transitions the Transwarp Nexus from ideation to autonomous execution. It implements a "Hybrid" swarm model that executes code changes in isolated worktrees, performs self-healing fix cycles, and provides a video-game inspired "Neural Swarm HUD" for real-time observability.

## 2. Core Architecture: The Shadow-Native Swarm
The swarm operates using **Approach A: Shadow-Native Swarm**.

### 2.1 Isolation via Worktrees
- Swarms operate in a dedicated git worktree located in `.kspec-worktrees/wave-XXXX`.
- This ensures the user's active development environment remains untouched during long-running implementation waves.
- Final changes are merged back only after user approval.

### 2.2 Orchestration Logic
- **Supervisor Agent**: Parses KSpec requirements and decomposes them into atomic "Waves".
- **Wave Lifecycle**:
    1. **Planning**: Supervisor maps ACs to specific file targets.
    2. **Impact Analysis**: Each target is checked via `gitnexus_impact`.
    3. **Execution**: Worker agents (Neurons) execute changes.
    4. **Verification**: `rtk bun run build` (or equivalent) is run.
    5. **Self-Healing**: Up to 5 retry cycles for build/test failures.
    6. **Staging**: If successful, changes are staged for review. If failed, a "Forensic Stash" branch is created.

## 3. Visual Interface: The Neural Swarm HUD
The UI takes inspiration from video games to convey swarm state efficiently.

### 3.1 The Synapse Canvas
- **Neural Nodes**: Floating nodes representing active agents.
    - Pulsate based on activity level (BPM tied to token usage/execution).
    - Glowing "Status Icons" (Regen icon for healing, Shield for security check).
- **Synapses**: Animated tendrils connecting agents during communication.
    - Particle flow represents data transfer.
    - Persistence represents active collaboration threads.

### 3.2 Game-Feel HUD Elements
- **Project Integrity Bar (HP)**: Visual health bar representing build status.
    - Depletes on failure, regenerates during successful self-healing.
- **Achievement/Combo Alerts**: Visual feedback for multi-file syncs or successful bug fixes.
- **Critical Choice Prompt**: High-contrast, RPG-style dialogue box for high-entropy decisions (Hybrid stop points).

## 4. Self-Healing & Forensics
- **Retry Limit**: 5 cycles.
- **Heuristics**:
    - Build failures -> Analyze logs -> Attempt targeted fix.
    - Missing dependency -> Attempt `bun add`.
    - Lint errors -> Run `lint --fix` or manual cleanup.
- **Forensic Stash**: On final failure, all partial changes are moved to a `forensics/wave-XX` branch for manual investigation.

## 5. Technical Requirements
- **Backend (Rust)**:
    - New `swarm_neural_stream` IPC event channel.
    - Worktree management logic in `orchestration.rs`.
- **Frontend (React)**:
    - `NeuralSwarmCanvas.tsx` using `react-force-graph` or custom SVG/WebGL layer.
    - `ImplementationHUD.tsx` for game-style overlays.
- **Testing**:
    - Mock "Broken Project" scenarios to verify self-healing reliability.

## 6. Success Criteria
- [ ] Users can trigger an "Implementation Wave" from a KSpec draft.
- [ ] Swarm successfully auto-resolves at least 3 types of build failures (imports, types, missing deps).
- [ ] Neural HUD provides a 1-second glanceability of swarm health and activity.
- [ ] Forensic stashing correctly isolates failed attempts without polluting `main`.
