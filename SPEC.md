# CMP Specification v0.1.0

This document defines the Capability Manifest Protocol (CMP) specification.

## 1. Terminology

- **Capability**: A discrete function a tool can perform (e.g., "delete emails")
- **Tool**: A program that exposes one or more capabilities (e.g., `inboxd`)
- **Domain**: A category of related tools (e.g., "email", "git", "files")
- **Manifest**: A minimal description of a tool's identity and purpose
- **Intent**: A natural language expression of what the caller wants to accomplish
- **Router**: The intermediary that translates intents to tool invocations
- **Facet**: An interface mode optimized for a specific consumer type (human/agent)

## 2. Design Goals

1. **O(1) context overhead**: AI agents should not pay context costs proportional to tool count
2. **Progressive disclosure**: Information loaded only when needed
3. **Intent-based invocation**: Callers express goals, not syntax
4. **Dual-audience**: Same tools work for humans and AI
5. **Existing tool compatibility**: Adapters, not rewrites

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

Manifests MUST be located at one of:

1. `<package>/cmp/manifest.json` (preferred)
2. `<package>/.cmp/manifest.json`
3. Embedded in package.json under `"cmp"` key

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

1. `<package>/cmp/capability.json` (preferred)
2. `<package>/.cmp/capability.json`

### 4.4 Pattern Matching

Patterns are matched using:

1. Exact substring match (case-insensitive)
2. Semantic similarity (if router supports embeddings)
3. Regex patterns (prefixed with `re:`)

Example with regex:
```json
{
  "patterns": [
    "delete emails",
    "re:delete.*email|remove.*message|trash"
  ]
}
```

## 5. Router Protocol

The router is the central component that translates intents to tool invocations.

### 5.1 Transport

Routers MUST support at least one of:

1. **Unix socket**: `/var/run/cmp.sock` or `~/.cmp/router.sock`
2. **HTTP**: `http://localhost:7890`
3. **Stdio**: For embedded routers

Messages are JSON-RPC 2.0.

### 5.2 Methods

#### 5.2.1 `cmp.domains`

List available domains.

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "cmp.domains",
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "domains": ["email", "git", "files", "web"]
  },
  "id": 1
}
```

#### 5.2.2 `cmp.manifests`

Get manifests for a domain (or all domains).

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "cmp.manifests",
  "params": { "domain": "email" },
  "id": 2
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "manifests": [
      {
        "domain": "email",
        "name": "inboxd",
        "summary": "Gmail management: triage, delete, restore",
        "version": "1.0.0"
      }
    ]
  },
  "id": 2
}
```

#### 5.2.3 `cmp.capabilities`

Get capabilities for a specific tool.

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "cmp.capabilities",
  "params": { "tool": "inboxd" },
  "id": 3
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "intents": [
      {
        "patterns": ["check email", "unread count"],
        "confirm": false,
        "destructive": false
      },
      {
        "patterns": ["delete emails", "trash messages"],
        "confirm": true,
        "destructive": true
      }
    ]
  },
  "id": 3
}
```

#### 5.2.4 `cmp.intent`

Execute an intent.

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "cmp.intent",
  "params": {
    "want": "delete these emails",
    "context": {
      "ids": ["abc123", "def456"]
    },
    "confirm": true
  },
  "id": 4
}

// Response (success)
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "tool": "inboxd",
    "command": "inbox delete --ids 'abc123,def456' --confirm",
    "output": {
      "deleted": 2,
      "ids": ["abc123", "def456"]
    }
  },
  "id": 4
}

// Response (needs confirmation)
{
  "jsonrpc": "2.0",
  "result": {
    "success": false,
    "reason": "confirmation_required",
    "tool": "inboxd",
    "command": "inbox delete --ids 'abc123,def456' --confirm",
    "message": "This will delete 2 emails. Set confirm: true to proceed."
  },
  "id": 4
}
```

#### 5.2.5 `cmp.schema`

Get full schema for a specific intent (Level 3 disclosure).

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "cmp.schema",
  "params": {
    "tool": "inboxd",
    "pattern": "delete emails"
  },
  "id": 5
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "patterns": ["delete emails", "trash messages", "remove emails"],
    "command": "inbox delete --ids {ids} --confirm",
    "params": {
      "ids": {
        "type": "array<string>",
        "required": true,
        "description": "Email IDs to delete"
      }
    },
    "returns": {
      "type": "object",
      "properties": {
        "deleted": { "type": "integer" },
        "ids": { "type": "array", "items": { "type": "string" } }
      }
    },
    "confirm": true,
    "destructive": true
  },
  "id": 5
}
```

### 5.3 Error Codes

| Code | Meaning |
|------|---------|
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32000 | Intent not matched |
| -32001 | Tool not found |
| -32002 | Confirmation required |
| -32003 | Execution failed |
| -32004 | Ambiguous intent (multiple matches) |

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

## 7. Tool Registration

Tools register with the router on installation.

### 7.1 Registration Methods

1. **Directory scanning**: Router scans known paths for `cmp/manifest.json`
2. **Explicit registration**: `cmp register <path>`
3. **Package hooks**: npm postinstall registers the tool

### 7.2 Search Paths

The router scans:

1. `~/.cmp/tools/`
2. `/usr/local/share/cmp/tools/`
3. Directories in `CMP_TOOL_PATH`
4. Node.js global modules with `cmp` in package.json

## 8. Adapter Layer

For existing CLIs without native CMP support.

### 8.1 Adapter Definition

```json
{
  "adapter": true,
  "wraps": "rg",
  "domain": "files",
  "name": "ripgrep",
  "summary": "Fast file content search",
  "discovery": {
    "help": "rg --help",
    "version": "rg --version"
  },
  "intents": [
    {
      "patterns": ["search for", "find in files", "grep"],
      "template": "rg --json \"{query}\" {path}",
      "params": {
        "query": { "type": "string", "required": true },
        "path": { "type": "string", "default": "." }
      },
      "outputParser": "jsonLines"
    }
  ]
}
```

### 8.2 Output Parsers

Built-in parsers for common output formats:

- `json`: Single JSON object
- `jsonLines`: Newline-delimited JSON
- `table`: Tabular text (parsed heuristically)
- `lines`: Line-per-result
- `custom`: User-defined regex

## 9. Security Considerations

### 9.1 Confirmation

Intents marked `confirm: true` MUST NOT execute without explicit confirmation.

The router returns `confirmation_required` error. The caller must resend with `confirm: true`.

### 9.2 Destructive Operations

Intents marked `destructive: true` SHOULD:

1. Require confirmation
2. Log the operation
3. Provide undo information if possible

### 9.3 Sandboxing

The router MAY enforce:

- Allow-lists of permitted tools
- Rate limiting
- Capability restrictions per caller

## 10. Context Injection

For AI agents, the router provides a minimal context snippet:

```
You have access to a Capability Router at cmp://localhost.
Available domains: email, git, files, web

To use tools, send intents like:
{ "want": "check email" }
{ "want": "delete these emails", "context": { "ids": [...] } }

Query cmp.manifests for tool details. Query cmp.schema for parameters.
```

This snippet is **< 100 tokens** regardless of how many tools are registered.

## 11. Versioning

- Manifests use semver
- Protocol version in all responses: `"cmp": "0.1.0"`
- Routers MUST support older manifest versions
- Breaking changes increment major version

## 12. File Structure Reference

```
mytool/
├── src/                       # Implementation
├── bin/
│   └── cli.js                 # Entry point
├── cmp/
│   ├── manifest.json          # Required: tool identity
│   ├── capability.json        # Required: intent mappings
│   └── examples.json          # Optional: usage examples
├── package.json
└── README.md
```

## Appendix A: Full Manifest + Capability Example

See `examples/inboxd/` in this repository.

## Appendix B: Reference Router Implementation

See `routers/node/` in this repository.
