# CMP Specification v0.2.0

This document defines the Capability Manifest Protocol (CMP) specification.

## 1. Terminology

- **Capability**: A discrete function a tool can perform (e.g., "delete emails")
- **Tool**: A program that exposes one or more capabilities (e.g., `inboxd`)
- **Domain**: A category of related tools (e.g., "email", "git", "files")
- **Manifest**: A minimal description of a tool's identity and purpose
- **Intent**: A natural language expression of what the caller wants to accomplish
- **Facet**: An interface mode optimized for a specific consumer type (human/agent)

## 2. Design Goals

1. **O(1) context overhead**: AI agents should not pay context costs proportional to tool count
2. **Progressive disclosure**: Information loaded only when needed
3. **Intent-based invocation**: Callers express goals, not syntax
4. **Dual-audience**: Same tools work for humans and AI
5. **Existing tool compatibility**: Adapters, not rewrites
6. **No middleware required**: AI agents read manifests directly

## 3. Manifest Format

Every CMP-compatible tool MUST provide a manifest.

### 3.1 Manifest Schema

```typescript
interface Manifest {
  // Required
  domain: string;        // Category: "email", "git", "files", etc.
  name: string;          // Tool identifier, unique within domain
  summary: string;       // One-line description, max 100 chars
  version: string;       // Semver

  // Optional
  binary?: string;       // Executable name if different from `name`
  requires?: string[];   // Other domains this tool depends on
  tags?: string[];       // Additional categorization
}
```

### 3.2 Manifest Example

```json
{
  "domain": "email",
  "name": "inboxd",
  "summary": "Gmail management: triage, delete, restore",
  "version": "1.0.0",
  "binary": "inbox",
  "tags": ["gmail", "notifications", "cleanup"]
}
```

### 3.3 Manifest Location

Manifests MUST be located at:

1. `<tool>/cmp/manifest.json` (preferred)
2. `<tool>/.cmp/manifest.json`

### 3.4 Token Budget

Manifests SHOULD be designed to serialize to < 50 tokens when minified.

## 4. Capability Format

Capabilities define what a tool can do and how to invoke it.

### 4.1 Capability Schema

```typescript
interface Capability {
  intents: Intent[];
}

interface Intent {
  // Pattern matching
  patterns: string[];         // Natural language patterns this intent matches

  // Invocation
  command: string;            // Command template with {param} placeholders

  // Parameters
  params?: {
    [name: string]: ParamDef;
  };

  // Output
  returns?: JsonSchema;       // JSON Schema for structured output

  // Behavior
  confirm?: boolean;          // Requires user confirmation (default: false)
  destructive?: boolean;      // Cannot be undone (default: false)
  idempotent?: boolean;       // Safe to retry (default: true)
}

interface ParamDef {
  type: "string" | "integer" | "boolean" | "array<string>" | "array<integer>";
  required?: boolean;         // Default: false
  default?: any;              // Default value if not provided
  description?: string;       // Human-readable description
  enum?: any[];               // Allowed values
}
```

### 4.2 Capability Example

```json
{
  "intents": [
    {
      "patterns": [
        "check email",
        "unread count",
        "inbox status",
        "how many emails"
      ],
      "command": "inbox summary --json",
      "returns": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "email": { "type": "string" },
            "unread": { "type": "integer" }
          }
        }
      }
    },
    {
      "patterns": [
        "delete emails",
        "trash messages",
        "remove emails"
      ],
      "command": "inbox delete --ids {ids} --confirm",
      "params": {
        "ids": {
          "type": "array<string>",
          "required": true,
          "description": "Email IDs to delete"
        }
      },
      "confirm": true,
      "destructive": true,
      "idempotent": false
    },
    {
      "patterns": [
        "restore emails",
        "undo delete",
        "recover messages"
      ],
      "command": "inbox restore --last {count}",
      "params": {
        "count": {
          "type": "integer",
          "default": 1,
          "description": "Number of deletions to undo"
        }
      }
    }
  ]
}
```

### 4.3 Capability Location

Capabilities MUST be located at:

1. `<tool>/cmp/capability.json` (preferred)
2. `<tool>/.cmp/capability.json`

### 4.4 Pattern Matching

AI agents match user intent to patterns using natural language understanding. Patterns serve as hints and examples, not exhaustive lists.

For tools that want explicit control, regex patterns are supported (prefixed with `re:`):

```json
{
  "patterns": [
    "delete emails",
    "re:delete.*email|remove.*message|trash"
  ]
}
```

## 5. Discovery Convention

CMP tools are discovered by AI agents through a standard file system convention.

### 5.1 Canonical Location

Tools MUST be installed to:

```
~/.cmp/tools/<tool-name>/
```

Example:
```
~/.cmp/tools/
  inboxd/
    cmp/
      manifest.json
      capability.json
    bin/
      inbox
  git-helper/
    cmp/
      manifest.json
      capability.json
```

### 5.2 Agent Discovery Flow

AI agents discover and use CMP tools by:

1. **List tools**: `ls ~/.cmp/tools/`
2. **Read manifest**: `~/.cmp/tools/<name>/cmp/manifest.json`
3. **Match domain**: Compare user intent to manifest domain/summary
4. **Read capability**: `~/.cmp/tools/<name>/cmp/capability.json`
5. **Match intent**: Find matching pattern in capability
6. **Execute command**: Run the command with substituted parameters

### 5.3 Agent Context Snippet

AI agents need minimal context to use CMP. Add to agent instructions:

```
## Local Tools (CMP)

CMP-compatible tools are installed in ~/.cmp/tools/. Each tool has:
- cmp/manifest.json: domain, name, summary
- cmp/capability.json: intents, parameters, commands

When a task might benefit from a local tool:
1. List ~/.cmp/tools/ to see available tools
2. Read manifest.json files to find relevant domain
3. Read capability.json to understand invocation
4. Execute the command directly with substituted parameters

Handle confirm:true intents by asking user permission before executing.
Handle destructive:true intents with extra caution.
```

This snippet is **< 100 tokens** regardless of how many tools are installed.

### 5.4 Progressive Disclosure

The discovery convention provides progressive disclosure:

```
Level 0: Tool list         ls ~/.cmp/tools/              (first query)
Level 1: Manifests         manifest.json per tool        (on domain match)
Level 2: Capabilities      capability.json               (on tool selection)
Level 3: Execution         Run command                   (on intent match)
```

Each level loads only when needed, keeping context overhead minimal.

## 6. Faceted Execution

Tools MAY support dual-mode execution for human and agent consumers.

### 6.1 Detection

Tools detect their consumer via:

1. **Environment variable**: `CMP_AGENT=1`
2. **TTY detection**: `!process.stdout.isTTY`
3. **Explicit flag**: `--agent` or `--json`

### 6.2 Output Modes

**Human mode**:
- Colored output (ANSI)
- Formatted tables, boxes
- Friendly error messages
- Progress indicators

**Agent mode**:
- JSON output only
- Structured errors with codes
- No ANSI escape sequences
- Machine-parseable format

### 6.3 Example Implementation

```javascript
#!/usr/bin/env node

const isAgent = process.env.CMP_AGENT === '1' || !process.stdout.isTTY;

async function main() {
  const result = await doWork();

  if (isAgent) {
    console.log(JSON.stringify(result));
  } else {
    const chalk = (await import('chalk')).default;
    console.log(chalk.green(`✓ Completed: ${result.message}`));
  }
}
```

## 7. Adapter Layer

For existing CLIs without native CMP support, create an adapter.

### 7.1 Adapter Definition

An adapter wraps an existing CLI with CMP metadata:

```
~/.cmp/tools/ripgrep-adapter/
  cmp/
    manifest.json
    capability.json
```

manifest.json:
```json
{
  "adapter": true,
  "wraps": "rg",
  "domain": "files",
  "name": "ripgrep",
  "summary": "Fast file content search",
  "version": "1.0.0"
}
```

capability.json:
```json
{
  "intents": [
    {
      "patterns": ["search for", "find in files", "grep"],
      "command": "rg --json \"{query}\" {path}",
      "params": {
        "query": { "type": "string", "required": true },
        "path": { "type": "string", "default": "." }
      }
    }
  ]
}
```

### 7.2 Adapter vs Native

- **Native CMP tool**: Includes cmp/ directory, may have faceted output
- **Adapter**: Wraps existing CLI, provides CMP metadata only

Both are discovered the same way. The `adapter: true` flag indicates the tool binary is external.

## 8. Security Considerations

### 8.1 Confirmation

Intents marked `confirm: true` indicate destructive or sensitive operations.

AI agents SHOULD:
1. Display the intended action to the user
2. Request explicit confirmation before executing
3. Never auto-confirm destructive operations

### 8.2 Destructive Operations

Intents marked `destructive: true` indicate operations that cannot be undone.

AI agents SHOULD:
1. Require confirmation (treat as confirm: true)
2. Warn the user about irreversibility
3. Suggest creating backups when appropriate

### 8.3 Parameter Validation

AI agents SHOULD validate parameters before execution:
- Required parameters are present
- Types match the schema
- Values are within allowed ranges (if enum specified)

## 9. File Structure Reference

### 9.1 Tool Structure

```
~/.cmp/tools/mytool/
├── cmp/
│   ├── manifest.json          # Required: tool identity
│   ├── capability.json        # Required: intent mappings
│   └── examples.json          # Optional: usage examples
├── bin/
│   └── mytool                  # The executable (or in PATH)
└── README.md                   # Optional: human documentation
```

### 9.2 Minimal Tool

A minimal CMP tool requires only two files:

```
~/.cmp/tools/hello/
└── cmp/
    ├── manifest.json
    └── capability.json
```

If the binary is already in PATH, no additional files are needed.

## 10. Versioning

- Manifests use semver
- Spec version: `0.2.0`
- Breaking changes increment major version
- Tools SHOULD specify minimum spec version if using newer features

## Appendix A: Full Manifest + Capability Example

See `examples/inboxd/` in this repository.

## Appendix B: Migration from v0.1.0

v0.1.0 defined a router-based protocol with JSON-RPC methods. v0.2.0 simplifies to a file-based convention.

**What changed:**
- Removed: Router protocol, JSON-RPC methods, socket/HTTP transport
- Added: `~/.cmp/tools/` canonical location, agent discovery flow
- Simplified: AI agents read files directly instead of querying a router

**Migration steps:**
1. Move tools to `~/.cmp/tools/<name>/`
2. Add agent context snippet to AI instructions
3. Router is now optional (useful for validation/testing)
