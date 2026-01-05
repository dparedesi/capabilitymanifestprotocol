# inboxd CMP Example

This directory shows how an existing CLI tool (`inboxd`) can be made CMP-compatible.

## Structure

```
inboxd/
└── cmp/
    ├── manifest.json      # Tool identity (< 50 tokens)
    ├── capability.json    # Intent to command mappings
    └── examples.json      # Usage examples for LLM context
```

## Installation

To install this tool for AI discovery:

```bash
cp -r examples/inboxd ~/.cmp/tools/
```

Or create a symlink:

```bash
ln -s $(pwd)/examples/inboxd ~/.cmp/tools/inboxd
```

## Manifest

The manifest is minimal - just enough for the AI to know this tool exists:

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

## How AI Uses This

When a user asks about email, the AI:

1. **Lists tools**: `ls ~/.cmp/tools/` shows `inboxd`
2. **Reads manifest**: `~/.cmp/tools/inboxd/cmp/manifest.json` shows domain is "email"
3. **Reads capability**: `~/.cmp/tools/inboxd/cmp/capability.json` shows available intents
4. **Matches intent**: User's request matches a pattern
5. **Executes command**: AI runs the command with substituted parameters

### Example Flow

```
User: "How many unread emails do I have?"

AI reads: ~/.cmp/tools/inboxd/cmp/manifest.json
   → {"domain": "email", "summary": "Gmail management..."}
   → This matches!

AI reads: ~/.cmp/tools/inboxd/cmp/capability.json
   → Finds pattern "unread count" → command "inbox summary --json"

AI runs: inbox summary --json
   → [{"name": "Personal", "email": "user@gmail.com", "unread": 5}]

AI responds: "You have 5 unread emails in your Personal account."
```

## Context Efficiency

With MCP, the full schema would be in context: **~500 tokens**.

With CMP:
- In context: Discovery instruction: **~80 tokens** (shared across all tools)
- Loaded on-demand: manifest (~30 tokens) + capability (~200 tokens)

**Key difference**: On-demand loading happens in the conversation (ephemeral), not the system prompt (persistent).

## Adding CMP to Your Tool

1. Create `cmp/manifest.json` with your tool's identity
2. Create `cmp/capability.json` with intent to command mappings
3. Ensure your CLI has a `--json` flag for structured output
4. Install to `~/.cmp/tools/<your-tool>/`
