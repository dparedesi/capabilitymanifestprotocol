# CMP Router

[![npm version](https://img.shields.io/npm/v/cmp-router.svg)](https://www.npmjs.com/package/cmp-router)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

The reference implementation of the [Capability Manifest Protocol (CMP)](../../SPEC.md) router — a lightweight, intent-based protocol for AI tool integration.

## What is CMP?

CMP solves the "tool explosion" problem for AI agents. Instead of loading every tool's schema into context, agents get a minimal snippet and query tools on-demand:

```
Traditional: Load 50 tool schemas → 10,000+ tokens
CMP: Load context snippet → ~100 tokens, query as needed
```

**Key benefits:**
- **O(1) context overhead** — Token cost doesn't scale with tool count
- **Intent-based** — Express goals, not syntax ("check email" vs `inbox --summary --json`)
- **Security-first** — Parameter validation, shell escaping, confirmation for destructive actions
- **Multiple transports** — HTTP, Unix socket, or stdio

## Installation

```bash
# Install globally
npm install -g cmp-router

# Or locally
npm install cmp-router
```

## Quick Start

```bash
# Initialize config directory
cmp init

# Register a tool
cmp register /path/to/my-tool

# Start the router
cmp start

# Execute an intent
cmp intent "check my email"
```

## CLI Reference

```bash
cmp start [options]       # Start the router server
cmp domains               # List available domains
cmp tools [domain]        # List registered tools
cmp register <path>       # Register a tool directory
cmp intent <text>         # Execute a natural language intent
cmp context               # Show context snippet for AI agents
cmp init                  # Initialize CMP config directory
```

### Server Options

```bash
cmp start                          # HTTP on port 7890 (default)
cmp start -p 8080                  # HTTP on custom port
cmp start --socket                 # Unix socket mode
cmp start --stdio                  # Stdio mode (for embedded use)
cmp start --hot-reload             # Watch for tool changes
cmp start --socket-path /tmp/cmp.sock  # Custom socket path
```

## API Reference

The router exposes a JSON-RPC 2.0 API. See [docs/integration.md](docs/integration.md) for complete documentation.

### Methods

| Method | Description |
|--------|-------------|
| `cmp.ping` | Health check |
| `cmp.domains` | List available domains |
| `cmp.manifests` | Get tool manifests |
| `cmp.capabilities` | Get tool capabilities |
| `cmp.schema` | Get intent parameter schema |
| `cmp.intent` | Execute a natural language intent |
| `cmp.context` | Get context snippet for AI agents |

### Example

```bash
# List domains
curl -X POST http://localhost:7890 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"cmp.domains","id":1}'

# Execute an intent
curl -X POST http://localhost:7890 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"cmp.intent","params":{"want":"check email"},"id":2}'
```

## Architecture

```
src/
├── index.js           # Router class - main entry point
├── registry.js        # Tool discovery and registration (with hot reload)
├── matcher.js         # Intent pattern matching
├── executor.js        # Command building and execution (with validation)
├── validator.js       # Parameter validation and shell escaping
├── server.js          # HTTP JSON-RPC server
├── socket-server.js   # Unix socket server
├── stdio-server.js    # Stdio server for embedded use
├── config.js          # Configuration loading
└── cli.js             # Command line interface
```

## Tool Registration

Tools are discovered from:

1. `~/.cmp/tools/` — User tools
2. `/usr/local/share/cmp/tools/` — System tools
3. `CMP_TOOL_PATH` environment variable
4. Explicitly registered paths via `cmp register`

Each tool directory must contain:

```
my-tool/
└── cmp/
    ├── manifest.json      # Tool identity (domain, name, summary)
    └── capability.json    # Intent patterns and commands
```

See the [CMP Specification](../../SPEC.md) for manifest and capability formats.

## Configuration

CMP Router loads configuration from multiple sources (highest to lowest priority):

1. **Environment variables**
2. **Config file** (`~/.cmp/config.json`)
3. **Default values**

### Config File

```json
{
  "timeout": 30000,
  "httpPort": 7890,
  "httpHost": "127.0.0.1",
  "socketPath": "~/.cmp/router.sock",
  "searchPaths": ["/path/to/tools"],
  "enableLogging": false
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CMP_TIMEOUT` | Command timeout (ms) | `30000` |
| `CMP_HTTP_PORT` | HTTP server port | `7890` |
| `CMP_SOCKET_PATH` | Unix socket path | `~/.cmp/router.sock` |
| `CMP_TOOL_PATH` | Colon-separated tool paths | — |
| `CMP_ENABLE_LOGGING` | Enable execution logging | `false` |

## Security

- **Parameter validation** — Type checking, required params, enum validation
- **Shell escaping** — Prevents command injection attacks
- **Confirmation flow** — Destructive actions require explicit confirmation
- **Timeout enforcement** — Commands timeout after 30s (configurable)
- **Allow/deny lists** — Restrict which tools can be executed

## Programmatic Usage

```javascript
import { Router } from 'cmp-router';

const router = await new Router().init();

// Get domains
const { domains } = router.domains();

// Execute an intent
const result = await router.intent({
  want: 'check email',
  confirm: false
});
```

## Integration

For AI tool authors, see [docs/integration.md](docs/integration.md) for:

- Protocol reference with examples
- Detection patterns
- Minimal and full integration patterns
- Code examples (Node.js, Python, Shell)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT — see [LICENSE](LICENSE)

## Related

- [CMP Specification](../../SPEC.md) — Protocol specification
- [inboxd](../../examples/inboxd/) — Example CMP-compatible tool
