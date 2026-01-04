# CMP Router Integration Guide

This guide explains how to integrate the CMP (Capability Manifest Protocol) router into AI tools, agents, and other applications.

## Table of Contents

1. [Protocol Reference](#protocol-reference)
2. [Detection](#detection)
3. [Integration Patterns](#integration-patterns)
4. [Code Examples](#code-examples)
5. [Error Handling](#error-handling)

---

## Protocol Reference

The CMP router uses JSON-RPC 2.0 over HTTP, Unix socket, or stdio.

### Transport Options

| Transport | Endpoint | Use Case |
|-----------|----------|----------|
| HTTP | `http://localhost:7890` | Default, cross-platform |
| Unix Socket | `~/.cmp/router.sock` | Faster local IPC |
| Stdio | Process stdin/stdout | Embedded subprocess |

### Methods

#### `cmp.ping`

Health check to verify the router is running.

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "cmp.ping",
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "status": "ok",
    "timestamp": 1704384000000
  },
  "id": 1,
  "cmp": "0.1.0"
}
```

#### `cmp.domains`

List all available tool domains.

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
    "domains": ["email", "git", "files"]
  },
  "id": 1,
  "cmp": "0.1.0"
}
```

#### `cmp.manifests`

Get tool manifests, optionally filtered by domain.

```json
// Request (all manifests)
{
  "jsonrpc": "2.0",
  "method": "cmp.manifests",
  "id": 2
}

// Request (filtered by domain)
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
  "id": 2,
  "cmp": "0.1.0"
}
```

#### `cmp.capabilities`

Get capabilities (intents) for a specific tool.

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
  "id": 3,
  "cmp": "0.1.0"
}
```

#### `cmp.schema`

Get the full schema for a specific intent pattern.

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "cmp.schema",
  "params": {
    "tool": "inboxd",
    "pattern": "delete emails"
  },
  "id": 4
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "patterns": ["delete emails", "trash messages"],
    "command": "inbox delete --ids {ids}",
    "params": {
      "ids": {
        "type": "array<string>",
        "required": true,
        "description": "Email IDs to delete"
      }
    },
    "confirm": true,
    "destructive": true
  },
  "id": 4,
  "cmp": "0.1.0"
}
```

#### `cmp.intent`

Execute a natural language intent.

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
  "id": 5
}

// Response (success)
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "tool": "inboxd",
    "intent": "delete emails",
    "command": "inbox delete --ids 'abc123,def456'",
    "output": {
      "deleted": 2
    }
  },
  "id": 5,
  "cmp": "0.1.0"
}

// Response (confirmation required)
{
  "jsonrpc": "2.0",
  "result": {
    "success": false,
    "reason": "confirmation_required",
    "tool": "inboxd",
    "command": "inbox delete --ids 'abc123,def456'",
    "message": "This action requires confirmation. Set confirm: true to proceed."
  },
  "id": 5,
  "cmp": "0.1.0"
}
```

#### `cmp.context`

Get a context snippet for AI agent system prompts.

```json
// Request
{
  "jsonrpc": "2.0",
  "method": "cmp.context",
  "id": 6
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "snippet": "You have access to a Capability Router.\nAvailable domains: email, git, files\n\nTo use tools, send intents like:\n{ \"want\": \"check email\" }\n\nQuery cmp.manifests for details."
  },
  "id": 6,
  "cmp": "0.1.0"
}
```

---

## Detection

Before integrating, check if the CMP router is available.

### HTTP Detection

```bash
# Check if router is running
curl -s -X POST http://localhost:7890 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"cmp.ping","id":1}' \
  && echo "Router is running"
```

### Unix Socket Detection

```bash
# Check if socket exists
[ -S ~/.cmp/router.sock ] && echo "Socket exists"

# Verify it's responsive
echo '{"jsonrpc":"2.0","method":"cmp.ping","id":1}' | \
  nc -U ~/.cmp/router.sock
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CMP_ROUTER_URL` | Override default router URL |
| `CMP_SOCKET_PATH` | Override default socket path |
| `CMP_DISABLE` | Set to `1` to disable CMP integration |

---

## Integration Patterns

### Minimal Integration

The simplest integration injects the context snippet into your AI agent's system prompt.

```
1. Check if router is running (ping)
2. Call cmp.context to get the snippet
3. Inject snippet into agent's system prompt
4. Route tool intents through cmp.intent
```

**Advantages:**
- Minimal code changes
- Works with any AI agent
- O(1) context overhead

**Flow:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Agent   │────▶│ CMP Router  │────▶│    Tool     │
│             │     │             │     │  (inboxd)   │
│ "check      │     │ Matches to  │     │             │
│  email"     │     │ cmp.intent  │     │ inbox       │
│             │◀────│             │◀────│  summary    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Full Integration

For deeper integration, query available tools on startup.

```
1. On startup: call cmp.domains to get available domains
2. Build domain awareness into agent (e.g., "I can help with email, git, files")
3. When user mentions a domain: call cmp.manifests to list tools
4. Before executing: call cmp.schema for parameter discovery
5. Execute: call cmp.intent with context and confirm flag
6. Handle confirmation flow for destructive actions
```

**Advantages:**
- Better UX with domain awareness
- Parameter validation before execution
- Proper confirmation handling

### Confirmation Flow

For destructive operations:

```
1. User: "delete my emails"
2. Agent calls cmp.intent with confirm: false
3. Router returns confirmation_required
4. Agent asks user: "This will delete emails. Proceed?"
5. User confirms
6. Agent calls cmp.intent with confirm: true
7. Router executes
```

---

## Code Examples

### Node.js

```javascript
import { request } from 'http';

class CMPClient {
  constructor(url = 'http://localhost:7890') {
    this.url = new URL(url);
    this.requestId = 0;
  }

  async call(method, params = {}) {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId
    });

    return new Promise((resolve, reject) => {
      const req = request({
        hostname: this.url.hostname,
        port: this.url.port,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async ping() {
    return this.call('cmp.ping');
  }

  async domains() {
    return this.call('cmp.domains');
  }

  async manifests(domain = null) {
    return this.call('cmp.manifests', domain ? { domain } : {});
  }

  async capabilities(tool) {
    return this.call('cmp.capabilities', { tool });
  }

  async schema(tool, pattern) {
    return this.call('cmp.schema', { tool, pattern });
  }

  async intent(want, context = {}, confirm = false) {
    return this.call('cmp.intent', { want, context, confirm });
  }

  async context() {
    return this.call('cmp.context');
  }
}

// Usage
const cmp = new CMPClient();

// Check if running
try {
  await cmp.ping();
  console.log('CMP Router is available');
} catch (e) {
  console.log('CMP Router not running');
}

// Get context for AI agent
const { snippet } = await cmp.context();
console.log('Inject into system prompt:', snippet);

// Execute an intent
const result = await cmp.intent('check email');
console.log('Result:', result);
```

### Python

```python
import json
import requests
from typing import Optional, Any

class CMPClient:
    def __init__(self, url: str = "http://localhost:7890"):
        self.url = url
        self.request_id = 0

    def call(self, method: str, params: dict = None) -> Any:
        self.request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self.request_id
        }

        response = requests.post(
            self.url,
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        result = response.json()

        if "error" in result:
            raise Exception(result["error"]["message"])

        return result["result"]

    def ping(self) -> dict:
        return self.call("cmp.ping")

    def domains(self) -> dict:
        return self.call("cmp.domains")

    def manifests(self, domain: Optional[str] = None) -> dict:
        params = {"domain": domain} if domain else {}
        return self.call("cmp.manifests", params)

    def capabilities(self, tool: str) -> dict:
        return self.call("cmp.capabilities", {"tool": tool})

    def schema(self, tool: str, pattern: str) -> dict:
        return self.call("cmp.schema", {"tool": tool, "pattern": pattern})

    def intent(self, want: str, context: dict = None, confirm: bool = False) -> dict:
        return self.call("cmp.intent", {
            "want": want,
            "context": context or {},
            "confirm": confirm
        })

    def context(self) -> dict:
        return self.call("cmp.context")


# Usage
cmp = CMPClient()

# Check if running
try:
    cmp.ping()
    print("CMP Router is available")
except:
    print("CMP Router not running")

# Get context for AI agent
snippet = cmp.context()["snippet"]
print(f"Inject into system prompt: {snippet}")

# Execute an intent
result = cmp.intent("check email")
print(f"Result: {result}")

# Handle confirmation flow
result = cmp.intent("delete emails", {"ids": ["abc123"]}, confirm=False)
if result.get("reason") == "confirmation_required":
    print(f"Confirm: {result['message']}")
    # After user confirms:
    result = cmp.intent("delete emails", {"ids": ["abc123"]}, confirm=True)
```

### Shell (curl)

```bash
#!/bin/bash

CMP_URL="${CMP_ROUTER_URL:-http://localhost:7890}"

# Helper function for JSON-RPC calls
cmp_call() {
  local method="$1"
  local params="${2:-{}}"

  curl -s -X POST "$CMP_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":$params,\"id\":1}"
}

# Check if router is running
cmp_ping() {
  cmp_call "cmp.ping" | jq -e '.result.status == "ok"' > /dev/null
}

# List domains
cmp_domains() {
  cmp_call "cmp.domains" | jq -r '.result.domains[]'
}

# List manifests
cmp_manifests() {
  local domain="$1"
  if [ -n "$domain" ]; then
    cmp_call "cmp.manifests" "{\"domain\":\"$domain\"}" | jq '.result.manifests'
  else
    cmp_call "cmp.manifests" | jq '.result.manifests'
  fi
}

# Execute intent
cmp_intent() {
  local want="$1"
  local confirm="${2:-false}"

  cmp_call "cmp.intent" "{\"want\":\"$want\",\"confirm\":$confirm}" | jq '.result'
}

# Get context snippet
cmp_context() {
  cmp_call "cmp.context" | jq -r '.result.snippet'
}

# Usage examples:
# cmp_ping && echo "Router running"
# cmp_domains
# cmp_manifests email
# cmp_intent "check email"
# cmp_context
```

---

## Error Handling

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| `-32700` | Parse error | Invalid JSON |
| `-32600` | Invalid request | Not valid JSON-RPC 2.0 |
| `-32601` | Method not found | Unknown method |
| `-32602` | Invalid params | Missing or invalid parameters |
| `-32603` | Internal error | Server error |
| `-32000` | Intent not matched | No tool matches the intent |
| `-32001` | Tool not found | Specified tool doesn't exist |
| `-32002` | Confirmation required | Destructive action needs confirmation |
| `-32003` | Execution failed | Command execution error |
| `-32004` | Ambiguous intent | Multiple tools match |

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "No tool matched intent: 'do something weird'",
    "data": {
      "want": "do something weird",
      "suggestions": ["check email", "list files"]
    }
  },
  "id": 1,
  "cmp": "0.1.0"
}
```

### Handling Errors

```javascript
try {
  const result = await cmp.intent('some action');

  if (!result.success) {
    if (result.reason === 'confirmation_required') {
      // Ask user for confirmation, then retry with confirm: true
    } else if (result.reason === 'ambiguous') {
      // Present options to user
      console.log('Multiple matches:', result.matches);
    }
  }
} catch (error) {
  if (error.code === -32000) {
    console.log('No tool found for this intent');
  } else if (error.code === -32003) {
    console.log('Execution failed:', error.message);
  }
}
```

---

## Best Practices

1. **Always ping first** - Check if the router is running before integrating
2. **Cache the context snippet** - Don't fetch on every request
3. **Handle confirmations gracefully** - Always check for `confirmation_required`
4. **Use specific intents** - More specific = better matches
5. **Pass context** - Include relevant IDs and data in the context object
6. **Log errors** - Use error codes for debugging
7. **Timeout appropriately** - Some commands may take time

---

## Future Work (v0.2.0+)

- `@cmp/client` - Official TypeScript/JavaScript client SDK
- `cmp-mcp-bridge` - MCP compatibility layer for existing MCP tools
- Semantic intent matching with embeddings
- WebSocket transport for real-time updates
