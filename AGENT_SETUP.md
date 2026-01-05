# CMP Agent Setup

This file contains the snippet you need to add to your AI agent's instructions (e.g., CLAUDE.md, system prompt) to enable CMP tool discovery.

## The Snippet

Copy this into your agent's instructions:

```markdown
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

## How It Works

With this snippet in your agent's context (~80 tokens), the agent can:

1. **Discover tools on-demand**: When user asks something that might need a tool, the agent lists `~/.cmp/tools/`
2. **Read manifests**: Agent reads `manifest.json` to find relevant tools by domain/summary
3. **Understand capabilities**: Agent reads `capability.json` to see what intents are available
4. **Execute directly**: Agent substitutes parameters into the command template and runs it

## Example Flow

User: "Check how many unread emails I have"

Agent thinks: This might need a local tool. Let me check.

```bash
ls ~/.cmp/tools/
# Output: inboxd  git-helper
```

Agent: "inboxd" sounds email-related. Let me check.

```bash
cat ~/.cmp/tools/inboxd/cmp/manifest.json
# Output: {"domain": "email", "name": "inboxd", "summary": "Gmail management..."}
```

Agent: This is the right domain. What can it do?

```bash
cat ~/.cmp/tools/inboxd/cmp/capability.json
# Output: {"intents": [{"patterns": ["check email", "unread count", ...], "command": "inbox summary --json"}]}
```

Agent: "unread count" matches. Execute:

```bash
inbox summary --json
# Output: [{"name": "Personal", "email": "user@gmail.com", "unread": 5}]
```

Agent to user: "You have 5 unread emails in your Personal account."

## Context Overhead

| Approach | Context Cost |
|----------|--------------|
| MCP (50 tools) | ~25,000 tokens |
| Skills (50 skills) | ~5,000 tokens |
| **CMP** | **~80 tokens** (just the snippet) |

Tool details are loaded on-demand into the conversation, not the system prompt.

## Customization

You can extend the snippet with domain hints if you know what tools are installed:

```markdown
## Local Tools (CMP)

CMP-compatible tools are installed in ~/.cmp/tools/. Each tool has:
- cmp/manifest.json: domain, name, summary
- cmp/capability.json: intents, parameters, commands

Installed domains: email, git, files

When a task involves these domains, check ~/.cmp/tools/ for available tools.
```

This gives the agent a hint about what's available without loading full schemas.
