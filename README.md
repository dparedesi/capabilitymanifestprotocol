# Capability Manifest Protocol (CMP)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A file format and convention for AI agents to discover and use CLI tools with O(1) context overhead.

## The Problem

| Approach | Context Cost | Issue |
|----------|--------------|-------|
| MCP | O(n) tools | Every tool schema in context |
| Skills | O(n) descriptions | Every skill description in context |
| CMP | **O(1)** | Just a discovery instruction |

**The fundamental issue**: current approaches load tool information upfront. 50 tools with 500 tokens each = 25,000 tokens gone before the conversation starts.

## The Solution

CMP is not a protocol or middleware. It's a **file format** and **location convention**.

1. **Tool authors**: Add two JSON files to your tool
2. **Users**: Install tools to `~/.cmp/tools/`
3. **AI agents**: Read files on-demand, execute commands directly

No servers. No middleware. The AI agent does the work.

## How It Works

### 1. Tool Author Adds Manifest Files

```
mytool/
└── cmp/
    ├── manifest.json      # What is this tool?
    └── capability.json    # What can it do?
```

**manifest.json** (~30 tokens):
```json
{
  "domain": "email",
  "name": "inboxd",
  "summary": "Gmail management: triage, delete, restore",
  "version": "1.0.0"
}
```

**capability.json**:
```json
{
  "intents": [
    {
      "patterns": ["check email", "unread count"],
      "command": "inbox summary --json"
    },
    {
      "patterns": ["delete emails"],
      "command": "inbox delete --ids {ids}",
      "params": {
        "ids": { "type": "array<string>", "required": true }
      },
      "confirm": true,
      "destructive": true
    }
  ]
}
```

### 2. User Installs to Standard Location

```bash
# Install a CMP tool
cp -r mytool ~/.cmp/tools/

# Result
~/.cmp/tools/
  inboxd/
    cmp/manifest.json
    cmp/capability.json
  git-helper/
    cmp/manifest.json
    cmp/capability.json
```

### 3. AI Agent Discovers On-Demand

Add this to your AI agent's instructions (CLAUDE.md, system prompt, etc.):

```markdown
## Local Tools (CMP)

CMP-compatible tools are installed in ~/.cmp/tools/. Each tool has:
- cmp/manifest.json: domain, name, summary
- cmp/capability.json: intents, parameters, commands

When a task might benefit from a local tool:
1. List ~/.cmp/tools/ to see available tools
2. Read manifest.json files to find relevant domain
3. Read capability.json to understand invocation
4. Execute the command directly with substituted parameters
```

That's it. ~80 tokens regardless of how many tools are installed.

### 4. Agent Uses Tools

```
User: "Check my unread emails"

Agent: Let me check for local tools.
       $ ls ~/.cmp/tools/
       → inboxd, git-helper

Agent: inboxd sounds relevant.
       $ cat ~/.cmp/tools/inboxd/cmp/manifest.json
       → {"domain": "email", ...}

Agent: Right domain. What can it do?
       $ cat ~/.cmp/tools/inboxd/cmp/capability.json
       → {"intents": [{"patterns": ["check email", ...], "command": "inbox summary --json"}]}

Agent: Found a match.
       $ inbox summary --json
       → [{"email": "user@gmail.com", "unread": 5}]

Agent: You have 5 unread emails.
```

## Why This Works

**Progressive disclosure**: Information loads only when needed.

```
Level 0: Discovery instruction     ~80 tokens     (always in context)
Level 1: Tool list                 ~10 tokens     (on first query)
Level 2: Manifests                 ~30 tokens     (per relevant tool)
Level 3: Capabilities              ~200 tokens    (per selected tool)
```

Compare to MCP: all 50 tool schemas (~25,000 tokens) in context from the start.

## Comparison

| Aspect | MCP | Skills | CMP |
|--------|-----|--------|-----|
| Context overhead | O(n) | O(n) | O(1) |
| Infrastructure | Server per tool | None | None |
| Discovery | Upfront schemas | Upfront descriptions | On-demand files |
| Tool authoring | Full server impl | Markdown instructions | Two JSON files |
| Invocation | Exact tool calls | Prompt injection | Intent matching |

CMP isn't trying to replace MCP or Skills. They solve different problems:

- **MCP**: Deep integrations with external systems (databases, APIs)
- **Skills**: Project-specific workflows and knowledge
- **CMP**: CLI tool invocation at scale

## Creating a CMP Tool

### Option 1: Native Tool

Add `cmp/` directory to your CLI tool:

```
mytool/
├── bin/mytool
├── cmp/
│   ├── manifest.json
│   └── capability.json
└── package.json
```

### Option 2: Adapter for Existing CLI

Create a wrapper for any CLI:

```
~/.cmp/tools/ripgrep-adapter/
└── cmp/
    ├── manifest.json    # {"adapter": true, "wraps": "rg", ...}
    └── capability.json  # intent mappings to rg commands
```

The CLI itself doesn't change. The adapter just provides metadata.

## Example Tool

See [`examples/inboxd/`](examples/inboxd/) for a complete example.

## Agent Setup

See [AGENT_SETUP.md](AGENT_SETUP.md) for the full agent integration guide.

## Specification

See [SPEC.md](SPEC.md) for the complete specification including:
- Manifest and capability schemas
- Parameter types and validation
- Security flags (confirm, destructive)
- Faceted execution (human vs agent output)

## Status

**v0.2.0** - Convention-based discovery

- Manifest format defined in [SPEC.md](SPEC.md)
- Capability format defined in [SPEC.md](SPEC.md)
- Example tool: `examples/inboxd/`
- Optional validator: `routers/node/` (for testing manifests)

## License

MIT
