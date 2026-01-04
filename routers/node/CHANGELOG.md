# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-04

### Added
- Initial release of CMP Router
- Core router functionality (`Router` class)
- Tool discovery and registration (`Registry`)
- Intent matching with regex, substring, and word overlap (`Matcher`)
- Secure command execution with shell escaping and timeout (`Executor`)
- Parameter validation with type checking and coercion (`Validator`)
- HTTP server with JSON-RPC 2.0 interface
- Unix socket server for local IPC
- Stdio server for embedded use
- Configuration system with file and environment variable support
- Comprehensive test suite (136 tests)

### Security
- Shell argument escaping to prevent command injection
- Command timeout enforcement (default 30s)
- Placeholder validation before execution
- Type validation and sanitization of all parameters

### JSON-RPC Methods
- `cmp.domains` - List available domains
- `cmp.manifests` - Get tool manifests
- `cmp.capabilities` - Get capabilities for a tool
- `cmp.schema` - Get full schema for an intent pattern
- `cmp.intent` - Execute an intent
- `cmp.context` - Get context snippet for AI agents
- `cmp.ping` - Health check

### Error Handling
- Proper JSON-RPC error codes per specification
- Structured error data with details
- Custom error classes: `CMPError`, `ValidationError`, `ExecutionError`
