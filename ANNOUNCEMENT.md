# Introducing CMP: Teach Your AI to Find Its Own Tools

**TL;DR**: We created a convention that lets AI assistants discover and use your CLI tools on-demand, without stuffing tool schemas into context. It's two JSON files and an 80-token instruction.

---

## The Problem Everyone's Hitting

If you've been building with AI, you've probably noticed something frustrating:

**The more tools you give your AI, the worse it gets.**

Add 10 tools? Works great. Add 50? It starts forgetting things. Add 100? It's spending half its brainpower just remembering what tools exist.

This isn't a bug. It's how current approaches work. Every tool you add takes up space in the AI's context window. That space is precious and expensive.

### The Current Options

**Option 1: MCP (Model Context Protocol)**

The standard for connecting AI to external tools and data. Every tool's full schema lives in the AI's context at all times. 50 tools with 500 tokens each means 25,000 tokens gone before you even say "hello."

MCP is great for deep integrations (databases, APIs, cloud services). But the context cost scales linearly with tool count.

**Option 2: Agent Skills (Claude Code)**

You define skills in SKILL.md files with a name, description, and instructions. Claude detects when a skill is relevant and loads it.

Skills are smarter about context: only the name and description load at startup. But skills are designed for workflows and specialized knowledge, not wrapping existing CLIs.

**Option 3: .cursorrules and similar**

Cursor, Windsurf, and other AI editors let you define coding standards and behaviors. Great for "always use TypeScript" but less useful for defining tool capabilities.

**The gap**: None of these solve the problem of "I have 200 CLI tools and I want AI to use them without rewriting each one or stuffing schemas into context."

---

## What If AI Just Learned Where to Look?

Here's the insight behind CMP:

Instead of memorizing every tool's manual upfront, what if the AI just knew where the manuals are stored and looked them up when needed?

That's it. That's the whole idea.

### How It Actually Works

**Step 1: Tool authors add two JSON files**

```
mytool/
└── cmp/
    ├── manifest.json      # "I'm an email tool called inboxd"
    └── capability.json    # "Say 'delete emails' and I'll run 'inbox delete --ids ...'"
```

**Step 2: Users install to a standard location**

```bash
cp -r mytool ~/.cmp/tools/
```

**Step 3: AI gets a simple instruction**

Add this to your AI's instructions (~80 tokens):

```
Local tools are in ~/.cmp/tools/. Each has manifest.json (what it is)
and capability.json (how to use it). Check there when a task might
need a local tool.
```

**Step 4: AI discovers on-demand**

When user says "check my email," the AI:
1. Lists `~/.cmp/tools/` and sees `inboxd`
2. Reads the manifest: "domain: email" - this is relevant
3. Reads the capability: "patterns: ['check email'], command: 'inbox summary --json'"
4. Runs the command and returns results

No middleware. No server. The AI reads files and runs commands.

---

## Why This Works Better

**Context overhead**:
- MCP: O(n) - all schemas upfront
- Skills: O(n) - all descriptions upfront
- CMP: O(1) - just the discovery instruction

**Progressive disclosure**:
- Start: 80-token instruction in context
- On query: Read manifest (30 tokens per relevant tool)
- On match: Read capability (200 tokens for selected tool)
- Execute: Run command, return result

The AI only loads what it needs, when it needs it.

---

## How CMP Compares

| Approach | Context Cost | Best For |
|----------|--------------|----------|
| MCP | O(n) schemas | Deep integrations (databases, APIs) |
| Agent Skills | O(n) descriptions | Project workflows, specialized knowledge |
| CMP | **O(1) instruction** | CLI tool invocation at scale |

CMP isn't trying to replace MCP or Agent Skills. They solve different problems. Use MCP for your database. Use Skills for your deployment workflow. Use CMP for the 50 CLI tools you want your AI to be able to use.

---

## For Vibe Coders

If you're building apps with AI assistance, CMP means:

1. **Your AI stays fast** - not bogged down memorizing tool manuals
2. **Add tools freely** - 10 tools or 1,000, same overhead
3. **No new infrastructure** - just files in a directory
4. **Your CLI tools just work** - add two JSON files, done

---

## For Developers

1. **O(1) context overhead** - tool count doesn't affect context usage
2. **Progressive disclosure** - schemas loaded on-demand
3. **Intent-based** - AI matches natural language to patterns
4. **Backwards compatible** - wrap existing CLIs without modification

---

## Try It Now

1. Create `~/.cmp/tools/` directory
2. Add a tool with `manifest.json` and `capability.json`
3. Add the discovery snippet to your AI's instructions
4. Ask your AI to use the tool

See the [full example](https://github.com/dparedesi/capabilitymanifestprotocol/tree/main/examples/inboxd) for a complete walkthrough.

---

## The Bigger Picture

AI tool usage is at an inflection point. The current approach (stuff everything in context) worked when we had 5 tools. It's breaking at 50. It won't work at 500.

CMP is our attempt at a simpler foundation:
- **Files** over protocols
- **Discovery** over registration
- **On-demand** over upfront
- **Convention** over configuration

The format is simple. The spec is public. We'd love your feedback.

---

**Links:**
- GitHub: [github.com/dparedesi/capabilitymanifestprotocol](https://github.com/dparedesi/capabilitymanifestprotocol)
- Full spec: [SPEC.md](https://github.com/dparedesi/capabilitymanifestprotocol/blob/main/SPEC.md)
- Agent setup: [AGENT_SETUP.md](https://github.com/dparedesi/capabilitymanifestprotocol/blob/main/AGENT_SETUP.md)

---

*Built by developers who got tired of context bloat.*
