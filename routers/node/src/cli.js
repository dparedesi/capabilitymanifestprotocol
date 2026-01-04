#!/usr/bin/env node

/**
 * CMP CLI - Command line interface for the Capability Router
 */

import { Router } from './index.js';
import { createServer } from './server.js';
import { createSocketServer } from './socket-server.js';
import { createStdioServer } from './stdio-server.js';
import { loadConfig } from './config.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

const CONFIG_DIR = join(homedir(), '.cmp');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'start':
    case 'serve':
      await serve(args.slice(1));
      break;

    case 'domains':
      await listDomains();
      break;

    case 'tools':
      await listTools(args[1]);
      break;

    case 'register':
      await register(args[1]);
      break;

    case 'intent':
      await executeIntent(args.slice(1));
      break;

    case 'context':
      await showContext();
      break;

    case 'init':
      await init();
      break;

    default:
      showHelp();
  }
}

async function serve(args) {
  // Parse flags
  const flags = {
    socket: false,
    stdio: false,
    port: 7890,
    socketPath: '/tmp/cmp-router.sock',
    hotReload: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--socket' || arg === '-s') {
      flags.socket = true;
    } else if (arg === '--stdio') {
      flags.stdio = true;
    } else if (arg === '--hot-reload' || arg === '-w') {
      flags.hotReload = true;
    } else if (arg === '--port' || arg === '-p') {
      flags.port = parseInt(args[++i]) || 7890;
    } else if (arg === '--socket-path') {
      flags.socketPath = args[++i];
    } else if (!arg.startsWith('-') && !isNaN(parseInt(arg))) {
      flags.port = parseInt(arg);
    }
  }

  // Load config and merge with flags
  const config = loadConfig();
  const port = flags.port || config.httpPort;
  const socketPath = flags.socketPath || config.socketPath;

  const router = await new Router().init();

  // Enable hot reload if requested
  if (flags.hotReload) {
    router.registry.enableHotReload((registry) => {
      console.log(`Hot reload: re-scanned ${registry.tools.size} tools`);
    });
  }

  // Start the appropriate server(s)
  if (flags.stdio) {
    // Stdio mode - for embedded use
    const server = createStdioServer(router);
    server.start();
    // Don't log to stdout in stdio mode - it would interfere with JSON-RPC
  } else if (flags.socket) {
    // Unix socket mode
    const socketServer = createSocketServer(router, { socketPath });
    await socketServer.listen();
    console.log(`CMP Router listening on socket: ${socketPath}`);
    console.log(`Registered ${router.registry.tools.size} tools`);
    console.log(`Domains: ${router.registry.getDomains().join(', ')}`);
    if (flags.hotReload) {
      console.log('Hot reload: enabled');
    }
  } else {
    // Default: HTTP server
    const server = createServer(router);
    server.listen(port, () => {
      console.log(`CMP Router listening on http://localhost:${port}`);
      console.log(`Registered ${router.registry.tools.size} tools`);
      console.log(`Domains: ${router.registry.getDomains().join(', ')}`);
      if (flags.hotReload) {
        console.log('Hot reload: enabled');
      }
    });
  }
}

async function listDomains() {
  const router = await new Router().init();
  const domains = router.domains();

  console.log('Available domains:');
  for (const domain of domains.domains) {
    const tools = router.registry.getToolsByDomain(domain);
    console.log(`  ${domain}: ${tools.map(t => t.name).join(', ')}`);
  }
}

async function listTools(domain) {
  const router = await new Router().init();
  const manifests = router.manifests(domain);

  console.log(domain ? `Tools in ${domain}:` : 'All tools:');
  for (const manifest of manifests.manifests) {
    console.log(`  ${manifest.name} (${manifest.domain})`);
    console.log(`    ${manifest.summary}`);
  }
}

async function register(path) {
  if (!path) {
    console.error('Usage: cmp register <path>');
    process.exit(1);
  }

  // Ensure config dir exists
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }

  // Load or create config
  let config = { searchPaths: [] };
  if (existsSync(CONFIG_FILE)) {
    config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));
  }

  // Add path if not already present
  const resolvedPath = join(process.cwd(), path);
  if (!config.searchPaths.includes(resolvedPath)) {
    config.searchPaths.push(resolvedPath);
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  // Verify registration
  const router = await new Router([resolvedPath]).init();
  console.log(`Registered tools from ${resolvedPath}:`);
  for (const tool of router.registry.getAllManifests()) {
    console.log(`  ${tool.name} (${tool.domain}): ${tool.summary}`);
  }
}

async function executeIntent(args) {
  const want = args.join(' ');

  if (!want) {
    console.error('Usage: cmp intent <natural language intent>');
    process.exit(1);
  }

  const router = await new Router().init();

  try {
    const result = await router.intent({ want, confirm: true });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

async function showContext() {
  const router = await new Router().init();
  console.log(router.contextSnippet());
}

async function init() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }

  const toolsDir = join(CONFIG_DIR, 'tools');
  if (!existsSync(toolsDir)) {
    await mkdir(toolsDir, { recursive: true });
  }

  console.log('CMP initialized:');
  console.log(`  Config: ${CONFIG_DIR}`);
  console.log(`  Tools:  ${toolsDir}`);
  console.log('\nTo register a tool:');
  console.log('  cmp register /path/to/tool');
  console.log('\nTo start the router:');
  console.log('  cmp start');
}

function showHelp() {
  console.log(`
CMP - Capability Manifest Protocol Router

Commands:
  cmp start [options]       Start the router server
  cmp domains               List available domains
  cmp tools [domain]        List registered tools
  cmp register <path>       Register a tool directory
  cmp intent <text>         Execute a natural language intent
  cmp context               Show context snippet for AI agents
  cmp init                  Initialize CMP config directory

Server Options:
  -p, --port <port>         HTTP port (default: 7890)
  -s, --socket              Use Unix socket instead of HTTP
  --socket-path <path>      Socket path (default: /tmp/cmp-router.sock)
  --stdio                   Use stdio mode (for embedded use)
  -w, --hot-reload          Watch for tool changes and reload

Examples:
  cmp start                          # HTTP on port 7890
  cmp start -p 8080                  # HTTP on port 8080
  cmp start --socket                 # Unix socket
  cmp start --stdio                  # Stdio mode
  cmp start --hot-reload             # With hot reload
  cmp register ./my-tool
  cmp intent "check my email"
  cmp domains
`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
