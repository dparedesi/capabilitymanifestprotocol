# inboxd CMP Example

This directory shows how an existing CLI tool (`inboxd`) can be made CMP-compatible.

## Structure

```
inboxd/
└── cmp/
    ├── manifest.json      # Tool identity (< 50 tokens)
    ├── capability.json    # Intent → command mappings
    └── examples.json      # Usage examples for LLM context
```

## Manifest

The manifest is minimal—just enough for the router to know this tool exists:

```json
{
  "domain": "email",
  "name": "inboxd",
  "summary": "Gmail management: triage, delete, restore",
  "version": "1.0.0"
}
```

When minified: **~30 tokens**.

## Capabilities

The capability file maps natural language patterns to CLI commands:

| Intent Pattern | Command |
|----------------|---------|
| "check email", "unread count" | `inbox summary --json` |
| "analyze emails" | `inbox analyze --count {count} --json` |
| "delete emails" | `inbox delete --ids {ids} --confirm` |
| "restore emails" | `inbox restore --last {count}` |

## How the Router Uses This

1. **Discovery**: Router scans and finds `cmp/manifest.json`
2. **Registration**: Adds `inboxd` to the `email` domain
3. **Intent matching**: When AI says "delete these emails", router matches to `delete emails` pattern
4. **Schema resolution**: Router loads `capability.json` to get parameter requirements
5. **Invocation**: Router constructs `inbox delete --ids 'abc,def' --confirm`
6. **Response**: Tool outputs JSON, router returns to AI

## Context Efficiency

With MCP, the full schema would be in context: **~500 tokens**.

With CMP:
- In context: domain list + router reference: **~30 tokens**
- Loaded on-demand when needed: capability.json

**Savings: 94% context reduction** for this tool alone.

## Adding to Your Tool

1. Create `cmp/manifest.json` with your tool's identity
2. Create `cmp/capability.json` with intent→command mappings
3. Ensure your CLI has a `--json` flag for structured output
4. Register with the CMP router: `cmp register .`
