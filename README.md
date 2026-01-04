# Capability Manifest Protocol (CMP)

> A context-efficient, intent-based protocol for AI agents to discover and invoke tools—without sacrificing human usability.

## The Problem

| Approach | Context Cost | Humans | AI | Existing Tools |
|----------|--------------|--------|-----|----------------|
| CLI | O(1) | ✓ | ✗ | ✓ |
| MCP | O(n) tools | ✗ | ✓ | ✗ (rewrites) |
| Skill files | O(n) instructions | ✗ | ~✓ | ~✓ (manual) |

**The fundamental issue**: we couple capability to interface.

A tool's *capability* is what it does. Its *interface* is how you invoke it. Current approaches force you to choose: optimize for humans (CLI) or optimize for AI (MCP). Both require the same capability to be implemented twice, or one audience gets a degraded experience.

**MCP's specific problem**: Every tool's full schema lives in the AI's context window. 50 tools × 500 tokens = 25,000 tokens gone before the conversation starts.

## The Solution: CMP

CMP separates capability from interface through three innovations:

1. **Manifests**: Tiny capability advertisements (< 50 tokens per tool)
2. **Progressive Resolution**: Schemas loaded on-demand, not upfront
3. **Intent-Based Invocation**: AI expresses *what* it wants, router handles *how*

### Context Overhead Comparison

```
MCP:  O(n) — All tool schemas in context
CMP:  O(1) — Only router awareness + domain list
```

## Core Concepts

### 1. The Manifest

Each tool exposes a manifest—a one-liner that says "I exist and do X":

```json
{
  "domain": "email",
  "name": "inboxd",
  "summary": "Gmail management: triage, delete, restore",
  "version": "1.0.0"
}
```

The AI's context only sees:

```
Available domains: email, git, files, web
Router: /var/run/cmp.sock
```

**~30 tokens regardless of how many tools are registered.**

### 2. Progressive Schema Resolution

Schemas are never in context. They're fetched at invocation time:

```
Level 0: Domain list       "email, git, files"              (in context)
Level 1: Manifests         "inboxd: Gmail management"       (on query)
Level 2: Commands          "summary, delete, restore"       (on query)
Level 3: Command schema    "delete: --ids, --confirm"       (on query)
Level 4: Examples          "inbox delete --ids 'a,b'"       (on query)
```

### 3. Intent-Based Invocation

Instead of constructing exact commands:

```json
// MCP style: AI must know exact syntax
{
  "method": "tools/call",
  "params": {
    "name": "inbox_delete",
    "arguments": { "ids": ["abc", "def"], "confirm": true }
  }
}

// CMP style: AI expresses intent
{
  "method": "intent",
  "params": {
    "want": "delete emails",
    "context": { "ids": ["abc", "def"] },
    "confirm": true
  }
}
```

The **Capability Router** translates intent → invocation.

### 4. The Capability Router

```
┌─────────────────────────────────────────────────────┐
│                    AI Agent                          │
│  Context: "router at cmp://; domains: email,git,fs" │
│  (O(1) overhead regardless of tool count)           │
└────────────────────────┬────────────────────────────┘
                         │
                         │ { "intent": "delete promotional emails" }
                         ▼
┌─────────────────────────────────────────────────────┐
│               Capability Router                      │
│                                                      │
│  1. Parse intent                                    │
│  2. Match → domain (email) → tool (inboxd)          │
│  3. Resolve schema for "delete" (lazy)              │
│  4. Translate → inbox delete --ids "..." --confirm  │
│  5. Execute, return structured result               │
└────────────────────────┬────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
     [inboxd]         [git]          [rg]
     (unchanged)    (unchanged)    (unchanged)
```

**Tools don't change.** The router adapts existing CLIs.

### 5. Faceted Tools (Dual-Mode)

Tools can auto-detect their consumer:

```javascript
const isAgent = process.env.CMP_ROUTER || !process.stdout.isTTY;

if (isAgent) {
  // Structured JSON, no colors, machine-parseable errors
  console.log(JSON.stringify({ deleted: 3, ids: ["a", "b", "c"] }));
} else {
  // Pretty output with colors, boxes, friendly messages
  console.log(chalk.green("✓ Deleted 3 emails"));
}
```

Same binary. Same capability. Interface adapts to consumer.

## File Structure for a CMP-Compatible Tool

```
mytool/
├── src/                    # Core capability implementation
├── bin/cli.js              # Human CLI interface
├── cmp/
│   ├── manifest.json       # Tiny capability advertisement
│   ├── capability.json     # Intent → command mappings
│   └── facet.agent.js      # (Optional) Rich agent interface
└── package.json
```

### manifest.json (~20 tokens)

```json
{
  "domain": "email",
  "name": "inboxd",
  "summary": "Gmail management: triage, delete, restore",
  "version": "1.0.0"
}
```

### capability.json (loaded on-demand)

```json
{
  "intents": [
    {
      "patterns": ["check email", "unread count", "inbox status"],
      "command": "inbox summary --json",
      "returns": {
        "type": "array",
        "items": { "name": "string", "unread": "integer" }
      }
    },
    {
      "patterns": ["delete emails", "trash messages", "remove emails"],
      "command": "inbox delete --ids {ids} --confirm",
      "params": {
        "ids": { "type": "array<string>", "required": true }
      },
      "confirm": true
    },
    {
      "patterns": ["restore emails", "undo delete", "recover messages"],
      "command": "inbox restore --last {count}",
      "params": {
        "count": { "type": "integer", "default": 1 }
      }
    }
  ]
}
```

## Router Protocol

### Query: List Domains

```json
// Request
{ "method": "domains" }

// Response
{ "domains": ["email", "git", "files", "web"] }
```

### Query: Domain Manifests

```json
// Request
{ "method": "manifests", "domain": "email" }

// Response
{
  "tools": [
    { "name": "inboxd", "summary": "Gmail management: triage, delete, restore" }
  ]
}
```

### Query: Tool Capabilities

```json
// Request
{ "method": "capabilities", "tool": "inboxd" }

// Response
{
  "intents": [
    { "patterns": ["check email", "unread count"], "confirm": false },
    { "patterns": ["delete emails"], "confirm": true },
    { "patterns": ["restore emails"], "confirm": false }
  ]
}
```

### Execute: Intent

```json
// Request
{
  "method": "intent",
  "params": {
    "want": "delete these emails",
    "context": { "ids": ["abc123", "def456"] },
    "confirm": true
  }
}

// Response
{
  "success": true,
  "result": { "deleted": 2, "ids": ["abc123", "def456"] },
  "tool": "inboxd",
  "command": "inbox delete --ids 'abc123,def456' --confirm"
}
```

## Adapting Existing CLIs

For tools that don't have native CMP support, the router can **learn** them:

```javascript
router.learn('rg', {
  // Parse --help to discover commands
  discovery: 'rg --help',

  // Probe to understand output format
  probe: 'rg --json "test" .',

  // Manual intent mappings
  intents: [
    { pattern: /search.*for|find.*in|grep/i, template: 'rg --json "{query}" {path}' },
    { pattern: /count.*matches/i, template: 'rg --count "{query}" {path}' }
  ]
});
```

The router builds a translation layer without modifying the original tool.

## Comparison with Alternatives

| Aspect | CLI | MCP | CMP |
|--------|-----|-----|-----|
| Context overhead | O(1) | O(n) | O(1) |
| Human usability | Native | None | Native (faceted) |
| AI usability | Poor | Native | Native |
| Schema loading | N/A | Upfront | On-demand |
| Invocation model | Exact commands | Exact tool calls | Intents |
| Existing tool support | Is the tool | Requires wrapper | Adapter learns |
| Discovery | --help (text) | Full schema | Progressive |

## Design Principles

1. **Context is precious.** Never waste tokens on schemas that might not be used.

2. **Intent over syntax.** AIs should express goals, not memorize command flags.

3. **Humans aren't second-class.** The same tool should work beautifully for both audiences.

4. **Existing tools matter.** Requiring rewrites means no adoption. Adapters enable migration.

5. **Progressive disclosure.** Only load what you need, when you need it.

## Open Questions

1. **Router transport**: Unix socket? HTTP? In-process function?

2. **Capability.json authorship**: Tool authors? Community? Auto-generated from --help?

3. **Intent ambiguity**: What if an intent matches multiple tools? (Probably: ask for clarification)

4. **Workflow composition**: Should the router support multi-step intents?

5. **Security model**: Per-tool confirmation? Global allow-lists? User prompts?

## Status

This is an early-stage specification. The goal is to:

1. Define the protocol precisely
2. Build a reference router implementation
3. Adapt one real tool (inboxd) as proof of concept
4. Gather feedback and iterate

## License

MIT
