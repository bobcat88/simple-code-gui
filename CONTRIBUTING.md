<!-- generated-by: gsd-doc-writer -->
# Contributing to simple-code-gui

Thank you for your interest in contributing. Please read this document before opening issues or submitting pull requests.

## License Agreement

simple-code-gui is released under the **PolyForm Noncommercial License 1.0.0**. By submitting a contribution (code, documentation, assets, or any other material), you agree that your contribution is licensed under the same terms. Contributions intended for commercial use are not accepted.

See [LICENSE](LICENSE) for the full license text.

## Development Setup

See [docs/guides/getting-started.md](docs/guides/getting-started.md) for prerequisites and first-run instructions, and [docs/guides/development.md](docs/guides/development.md) for local development setup.

**Prerequisites summary:**
- Rust >= 1.77.2 (install via [rustup](https://rustup.rs/))
- Bun (JavaScript runtime and package manager)
- Tauri CLI 2.10.1 (installed via `bun install`)
- A supported OS: Linux, macOS, or Windows with WebView2

**Install and start the dev build:**

```bash
bun install
bun run tauri:dev
```

Frontend-only (no Tauri shell):

```bash
bun run dev
```

## Coding Standards

This project enforces style via [Biome](https://biomejs.dev/) (`biome.json`).

- **Linter + formatter**: Biome handles both. Run before committing:
  ```bash
  bun run lint         # check violations
  bun run lint:fix     # auto-fix safe violations
  bun run format       # format src/ in place
  ```
- **Style rules**: 2-space indentation, single quotes, trailing commas (ES5), import organisation enforced automatically.
- **Rust**: `cargo fmt` and `cargo clippy` for `src-tauri/`. Fix all clippy warnings before submitting.
- CI enforces both Biome and type-check passes. PRs that fail these checks will not be reviewed.
- TypeScript strict mode is on — avoid `any`; use proper types or `unknown`.

## Running Tests

```bash
bun run test              # full Vitest suite (single run)
bun run test:watch        # watch mode during development
bun run test:coverage     # coverage report
```

All tests must pass before submitting a PR. Add tests for new behaviour — untested code will be returned for revision.

## PR Guidelines

- **Branch naming**: `feat/<short-description>`, `fix/<short-description>`, `docs/<short-description>`, `refactor/<short-description>`.
- **Base branch**: target `main`.
- **Commits**: use [Conventional Commits](https://www.conventionalcommits.org/) format — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- **Scope**: keep PRs focused. One logical change per PR. Large refactors should be discussed in an issue first.
- **Tests**: new features require unit tests. Bug fixes should include a regression test.
- **Docs**: update relevant docs in `docs/` if your change affects behaviour described there.
- **Draft PRs**: use draft status while work is in progress; mark ready for review only when all checks pass.

## Issue Reporting

There are no issue templates at this time. When reporting a bug, include:

1. Steps to reproduce (minimal and specific)
2. Expected behaviour
3. Actual behaviour
4. Environment: OS, Tauri version, Rust version, Bun version
5. Relevant logs from the Tauri console or terminal output

For feature requests, describe the use case and why existing behaviour does not address it.

Open issues on the project's GitHub Issues page.
