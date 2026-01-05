# CMP Router (Optional Development Tool)

[![npm version](https://img.shields.io/npm/v/cmp-router.svg)](https://www.npmjs.com/package/cmp-router)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Note**: As of CMP v0.2.0, the router is optional. AI agents can discover and use CMP tools by reading files directly. This router is useful for validation, testing, and development workflows.

## When to Use This

- **Validating manifests** during tool development
- **Testing intent matching** before deploying a tool
- **Debugging** capability.json patterns
- **Legacy integrations** that need JSON-RPC interface

For most use cases, you don't need the router. See the main [README](../../README.md) for the file-based approach.

## Installation

```bash
npm install -g cmp-router
```

## Quick Start

```bash
# Validate a tool's CMP files
cmp validate ~/.cmp/tools/mytool

# Test intent matching
cmp intent "check my email"

# List discovered tools
cmp tools
```

## CLI Reference

```bash
cmp validate <path>       # Validate manifest and capability files
cmp tools [domain]        # List registered tools
cmp intent <text>         # Test intent matching
cmp start [options]       # Start router server (for legacy use)
```

### Validation

```bash
# Validate a single tool
cmp validate ~/.cmp/tools/inboxd
# ✓ manifest.json is valid
# ✓ capability.json is valid
# ✓ 5 intents defined
# ✓ All patterns have at least one test match

# Validate all tools
cmp validate ~/.cmp/tools/*
```

### Intent Testing

```bash
# Test if an intent matches
cmp intent "delete my emails"
# Match: inboxd
# Pattern: "delete emails"
# Command: inbox delete --ids {ids} --confirm
# Confirm: true, Destructive: true
```

## Tool Discovery

The router scans these locations for CMP tools:

1. `~/.cmp/tools/` (primary)
2. `/usr/local/share/cmp/tools/`
3. `CMP_TOOL_PATH` environment variable

Each tool must have:

```
my-tool/
└── cmp/
    ├── manifest.json      # Tool identity
    └── capability.json    # Intent patterns
```

## Server Mode (Legacy)

For integrations that need JSON-RPC, the router can run as a server:

```bash
cmp start                 # HTTP on port 7890
cmp start --socket        # Unix socket
cmp start --stdio         # Stdio mode
```

### JSON-RPC Methods

| Method | Description |
|--------|-------------|
| `cmp.ping` | Health check |
| `cmp.domains` | List available domains |
| `cmp.manifests` | Get tool manifests |
| `cmp.intent` | Execute an intent |

## Programmatic Usage

```javascript
import { Router } from 'cmp-router';

const router = await new Router().init();

// Validate a tool
const errors = await router.validate('/path/to/tool');

// Test intent matching
const match = router.match('check email');
console.log(match.tool, match.pattern, match.command);
```

## Development

```bash
npm install
npm test
npm run test:watch
```

## Architecture

```
src/
├── index.js           # Router class
├── registry.js        # Tool discovery
├── matcher.js         # Intent matching
├── executor.js        # Command execution
├── validator.js       # Parameter validation
├── server.js          # HTTP JSON-RPC
├── socket-server.js   # Unix socket
├── stdio-server.js    # Stdio
└── cli.js             # CLI interface
```

## License

MIT

## Related

- [CMP Specification](../../SPEC.md)
- [Example Tool: inboxd](../../examples/inboxd/)
- [Agent Setup Guide](../../AGENT_SETUP.md)
