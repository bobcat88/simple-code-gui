# Phase 26: Brainstorm Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an integrated ideation and specification workspace in the Intelligence Sidebar to capture "Seeds" and draft KSpec requirements.

**Architecture:**
1.  **Backend (Rust)**: IPC handlers for managing Seeds (Markdown files in `.planning/seeds/`) and KSpec Drafts (YAML in `.kspec/modules/drafts/`).
2.  **Frontend (React)**: A new `BrainstormTab` in `IntelligenceSidebar` with sub-tabs for "Ideas" and "Drafts".
3.  **Promotion**: Logic to convert Seeds into Specs or Beads Tasks.

**Tech Stack:** Rust (Tauri), React, TypeScript, Lucide Icons, Glassmorphism UI.

---

### Task 1: Backend IPC - Seed Management

**Files:**
- Modify: `src-tauri/src/orchestration.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Define GsdSeed struct and IPC handlers**
Add `GsdSeed` struct and `gsd_list_seeds`, `gsd_plant_seed` handlers to `orchestration.rs`.

- [ ] **Step 2: Register handlers in `lib.rs`**
Add `gsd_list_seeds` and `gsd_plant_seed` to `generate_handler!`.

- [ ] **Step 3: Commit**

### Task 2: Backend IPC - KSpec Drafting

**Files:**
- Modify: `src-tauri/src/orchestration.rs`

- [ ] **Step 1: Add KSpec draft handlers**
Add `kspec_write_draft` and `kspec_list_drafts`.

- [ ] **Step 2: Commit**

### Task 3: Frontend API & Types

**Files:**
- Modify: `src/renderer/api/types.ts`

- [ ] **Step 1: Add types and ExtendedApi methods**

- [ ] **Step 2: Commit**

### Task 4: Frontend - Brainstorm Shell

**Files:**
- Create: `src/renderer/components/intelligence/BrainstormTab.tsx`
- Modify: `src/renderer/components/intelligence/IntelligenceSidebar.tsx`

- [ ] **Step 1: Create BrainstormTab container**
Basic layout with sub-tabs (Ideas/Drafts).

- [ ] **Step 2: Register in Sidebar**
Add a "Brainstorm" tab to the main sidebar view.

- [ ] **Step 3: Commit**

### Task 5: Frontend - Idea Inbox

**Files:**
- Create: `src/renderer/components/intelligence/IdeaInbox.tsx`

- [ ] **Step 1: Implement Seed List and Capture**
List existing seeds and provide a quick-add input.

- [ ] **Step 2: Commit**

### Task 6: Frontend - Spec Editor

**Files:**
- Create: `src/renderer/components/intelligence/SpecDraftEditor.tsx`

- [ ] **Step 1: Implement YAML/Markdown Editor**
 density-optimized editor for KSpec drafting.

- [ ] **Step 2: Commit**

### Task 7: Frontend - Promotion Workflow

**Files:**
- Create: `src/renderer/components/intelligence/PromotionWorkflow.tsx`

- [ ] **Step 1: Implement Idea -> Task conversion**
Call `beads_create` with seed data.

- [ ] **Step 2: Commit**
