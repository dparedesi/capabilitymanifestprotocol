# CMP Router (Go)

Go implementation of the [Capability Manifest Protocol](../../SPEC.md) router.

## Status: Planned

This implementation is not yet started.

## TODO

- [ ] Project setup (go.mod)
- [ ] Core router struct
- [ ] Registry (tool discovery, manifest loading)
- [ ] Matcher (intent pattern matching)
- [ ] Executor (command building, exec.Command)
- [ ] Validator (parameter validation, type coercion)
- [ ] HTTP server (JSON-RPC 2.0)
- [ ] Unix socket server
- [ ] CLI (`cmp` command)
- [ ] Tests
- [ ] Release binaries (goreleaser)

## Why Go?

- Single binary distribution (no runtime dependencies)
- High performance for production deployments
- Easy cross-compilation for multiple platforms
- Excellent for system-level tool integration

## Contributing

See the [main specification](../../SPEC.md) for protocol details. The Node.js implementation in [routers/node/](../node/) serves as the reference.
