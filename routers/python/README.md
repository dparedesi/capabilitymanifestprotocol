# CMP Router (Python)

Python implementation of the [Capability Manifest Protocol](../../SPEC.md) router.

## Status: Planned

This implementation is not yet started.

## TODO

- [ ] Project setup (pyproject.toml, Poetry/uv)
- [ ] Core router class
- [ ] Registry (tool discovery, manifest loading)
- [ ] Matcher (intent pattern matching)
- [ ] Executor (command building, subprocess management)
- [ ] Validator (parameter validation, type coercion)
- [ ] HTTP server (JSON-RPC 2.0)
- [ ] Unix socket server
- [ ] CLI (`cmp` command)
- [ ] Tests (pytest)
- [ ] PyPI publication

## Why Python?

- Native integration with Python AI frameworks (LangChain, LlamaIndex, etc.)
- Easier embedding in Python-based agents
- Familiar tooling for ML/AI developers

## Contributing

See the [main specification](../../SPEC.md) for protocol details. The Node.js implementation in [routers/node/](../node/) serves as the reference.
