# CMP - Development Guide

## Project Overview

The Capability Manifest Protocol (CMP) - a file format and convention for AI agents to discover and use CLI tools with O(1) context overhead.

## What CMP Is

CMP is NOT a protocol or middleware. It's:
1. **A manifest format** - Two JSON files that describe a tool
2. **A location convention** - Tools live in `~/.cmp/tools/`
3. **An agent instruction** - ~80 tokens that teach AI where to look

AI agents read the files directly. No router required.

## Repository Structure

```
capabilitymanifestprotocol/
├── README.md              # Main documentation
├── SPEC.md                # Full specification (v0.2.0)
├── AGENT_SETUP.md         # Agent integration guide
├── ANNOUNCEMENT.md        # Blog post / announcement
├── CLAUDE.md              # This file
├── examples/
│   └── inboxd/            # Example CMP-compatible tool
└── routers/
    └── node/              # Optional validator/dev tool
```

## Key Files

| File | Purpose |
|------|---------|
| `SPEC.md` | Manifest and capability schemas, discovery convention |
| `AGENT_SETUP.md` | The ~80 token snippet users add to their AI instructions |
| `README.md` | Overview and getting started |
| `examples/inboxd/` | Reference example showing file structure |

## The CMP Format

### manifest.json

```json
{
  "domain": "email",
  "name": "inboxd",
  "summary": "Gmail management: triage, delete, restore",
  "version": "1.0.0"
}
```

### capability.json

```json
{
  "intents": [
    {
      "patterns": ["check email", "unread count"],
      "command": "inbox summary --json"
    }
  ]
}
```

### Location Convention

```
~/.cmp/tools/
  inboxd/
    cmp/
      manifest.json
      capability.json
  another-tool/
    cmp/
      manifest.json
      capability.json
```

## Optional Router (routers/node/)

The Node.js router is now an optional development tool for:
- Validating manifest/capability files
- Testing intent matching
- Legacy JSON-RPC integrations

### Quick Reference

```bash
cd routers/node

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Validate a tool
node src/cli.js validate /path/to/tool
```

### Router Architecture

```
routers/node/src/
├── index.js           # Router class
├── registry.js        # Tool discovery
├── matcher.js         # Intent pattern matching
├── executor.js        # Command execution
├── validator.js       # Parameter validation
└── cli.js             # CLI interface
```

## Common Tasks

### Adding a new example tool

1. Create directory in `examples/<tool-name>/`
2. Add `cmp/manifest.json` with domain, name, summary, version
3. Add `cmp/capability.json` with intents array
4. Add README.md explaining the tool

### Updating the specification

1. Edit `SPEC.md`
2. Update version number if breaking change
3. Update `README.md` if user-facing changes
4. Update `AGENT_SETUP.md` if snippet changes

### Testing manifest validation

```bash
cd routers/node
npm test -- --grep "validator"
```

## Files to Never Commit

- `node_modules/`
- `.env` files with secrets
- `coverage/` reports
- `.context/` session files
