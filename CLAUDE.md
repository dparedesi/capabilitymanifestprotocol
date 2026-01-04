# CMP - Development Guide

## Project Overview

The Capability Manifest Protocol (CMP) — an intent-based protocol for AI tool integration that provides O(1) context overhead.

## Repository Structure

```
capabilitymanifestprotocol/
├── README.md              # Protocol overview
├── SPEC.md                # Full specification
├── CLAUDE.md              # This file
├── examples/
│   └── inboxd/            # Example CMP-compatible tool
└── routers/
    ├── node/              # Reference implementation (npm: cmp-router)
    ├── python/            # Planned
    └── go/                # Planned
```

## Node.js Router (Reference Implementation)

### Quick Reference

```bash
cd routers/node

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Start the router
npm start

# Start with options
node src/cli.js start --socket --hot-reload
```

### Architecture

```
routers/node/src/
├── index.js           # Router class - orchestrates all components
├── registry.js        # Tool discovery, registration, hot reload
├── matcher.js         # Intent pattern matching (exact, regex, word overlap)
├── executor.js        # Command building and execution with timeouts
├── validator.js       # Parameter validation, type coercion, shell escaping
├── server.js          # HTTP JSON-RPC server (exports handleRequest)
├── socket-server.js   # Unix socket server
├── stdio-server.js    # Stdio server for embedded use
├── config.js          # Configuration loading from file/env
└── cli.js             # Command line interface
```

### Key Design Decisions

1. **Shell escaping**: Uses single-quote wrapping with `'\''` for embedded quotes
2. **Timeout**: Default 30s, enforced via `setTimeout` + process kill
3. **Hot reload**: Uses `fs.watch` with 100ms debounce
4. **handleRequest sharing**: All servers import from `server.js`

### Testing

Tests use vitest. 136 tests across 6 files:

- `test/unit/validator.test.js` — Parameter validation
- `test/unit/matcher.test.js` — Intent pattern matching
- `test/unit/executor.test.js` — Command execution
- `test/unit/registry.test.js` — Tool discovery
- `test/integration/router.test.js` — Full intent flow
- `test/integration/server.test.js` — HTTP JSON-RPC

Mock tool fixture: `test/fixtures/mock-tool/`

## JSON-RPC Methods

| Method | Required Params |
|--------|-----------------|
| `cmp.ping` | — |
| `cmp.domains` | — |
| `cmp.manifests` | `domain?` |
| `cmp.capabilities` | `tool` |
| `cmp.schema` | `tool`, `pattern` |
| `cmp.intent` | `want`, `context?`, `confirm?` |
| `cmp.context` | — |

## Error Codes

| Code | Meaning |
|------|---------|
| `-32602` | Invalid/missing params |
| `-32000` | Intent not matched |
| `-32001` | Tool not found |
| `-32002` | Confirmation required |
| `-32003` | Execution failed |
| `-32004` | Ambiguous intent |

## Common Tasks

### Adding a new JSON-RPC method

1. Add handler in `src/server.js` `handleRequest` function
2. Add corresponding method to `Router` class in `src/index.js`
3. Add tests in `test/integration/server.test.js`

### Modifying parameter validation

1. Update `src/validator.js`
2. Add tests in `test/unit/validator.test.js`

### Adding CLI commands

1. Update `src/cli.js` switch statement
2. Update `showHelp()` function

## Files to Never Commit

- `node_modules/`
- `.env` files with secrets
- `coverage/` reports
- `.context/` session files
