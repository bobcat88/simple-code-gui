# Systems Index

This document tracks the design and implementation status of all Simple Code GUI systems.

## Progress Tracker
- **Total Systems**: 3
- **Not Started**: 0
- **In Design**: 0
- **Designed**: 0
- **Approved**: 0
- **Partially Implemented**: 2
- **Implemented**: 1

## Foundation Layer
| Priority | System | Status | Design Doc | Implementation |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Spec-Driven Contract | Partially Implemented | [spec-driven-development-contract.md](spec-driven-development-contract.md) | Beads/KSpec adapters, task detail AC surface, GSD/AI runtime projections |
| 2 | Capability Scanner | Implemented | [project-capability-scanner-design.md](project-capability-scanner-design.md) | `src-tauri/src/project_scanner.rs`, `project_scan`, `project_scan_async` |

## Core Layer
| Priority | System | Status | Design Doc | Implementation |
| :--- | :--- | :--- | :--- | :--- |
| 3 | Initialization & Upgrade Flow | Partially Implemented | [initialization-upgrade-flow-design.md](initialization-upgrade-flow-design.md) | `ProjectInitializationWizard`, `project_generate_proposal`, `project_apply_proposal` |

## Current Notes

- The scanner backend and async scan job path are implemented.
- The initialization proposal/apply path exists, but the design document still contains future UX and rollback hardening details.
- The spec-driven contract is represented in Beads/KSpec adapters and task-detail acceptance criteria surfaces, but it is not yet a single persisted internal domain model.
