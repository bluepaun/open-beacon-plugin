## Build Goal

Build an Opencode plugin that provides semantic code search across a codebase.
Search should work by meaning, not only by exact string matching.

Reference:

- `https://github.com/sagarmk/beacon-plugin`

## Use

- Bun
- TypeScript
- Husky
- Hybrid search:
  - semantic similarity
  - BM25 keyword matching
  - identifier boosting
- Ollama
- OpenAI Capability API (v1)

## Follow These Rules

- Use ES Modules only
- Never use CommonJS
- Prefer destructuring when it improves clarity
- Do not duplicate code
- Extract shared logic aggressively when repetition appears
- Keep TypeScript in strict mode

## Development Process

- Follow TDD
- Always use RED-GREEN-REFACTOR
- Write tests before implementation
- Prefer running a single relevant test instead of the full suite
- Run `bun typecheck` after every code change

## Git Rules

- Branch names:
  - `feature/[task-name]`
  - `fix/[issue-number]`
- Use Conventional Commits:
  - `feat:`
  - `fix:`
  - `docs:`
  - `refactor:`

## Priorities

- Maintainable architecture
- Reusable abstractions
- Consistent provider interfaces
- Clear and testable code
- Minimal, focused implementations
