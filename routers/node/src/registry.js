/**
 * Registry - Tool discovery and registration
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, watch } from 'fs';

const DEFAULT_SEARCH_PATHS = [
  join(homedir(), '.cmp', 'tools'),
  '/usr/local/share/cmp/tools'
];

export class Registry {
  constructor(searchPaths = []) {
    this.searchPaths = [...DEFAULT_SEARCH_PATHS, ...searchPaths];
    this.tools = new Map();       // name -> tool
    this.domains = new Map();     // domain -> [tool names]
    this.capabilities = new Map(); // name -> capability (cached)
    this.watchers = [];           // Active file watchers
    this.hotReloadEnabled = false;
  }

  /**
   * Scan search paths for CMP-compatible tools
   */
  async scan() {
    for (const basePath of this.searchPaths) {
      if (!existsSync(basePath)) continue;

      const entries = await readdir(basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const toolPath = join(basePath, entry.name);
        await this.tryRegister(toolPath);
      }
    }

    // Also check CMP_TOOL_PATH env var
    const envPaths = process.env.CMP_TOOL_PATH?.split(':') || [];
    for (const path of envPaths) {
      if (existsSync(path)) {
        await this.tryRegister(path);
      }
    }

    return this;
  }

  /**
   * Attempt to register a tool from a directory
   */
  async tryRegister(toolPath) {
    const manifestPaths = [
      join(toolPath, 'cmp', 'manifest.json'),
      join(toolPath, '.cmp', 'manifest.json')
    ];

    for (const manifestPath of manifestPaths) {
      if (!existsSync(manifestPath)) continue;

      try {
        const content = await readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        this.register({
          ...manifest,
          path: dirname(manifestPath)
        });

        return true;
      } catch (err) {
        console.warn(`Failed to load manifest at ${manifestPath}:`, err.message);
      }
    }

    return false;
  }

  /**
   * Register a tool
   */
  register(tool) {
    const { name, domain } = tool;

    this.tools.set(name, tool);

    if (!this.domains.has(domain)) {
      this.domains.set(domain, []);
    }
    this.domains.get(domain).push(name);
  }

  /**
   * Get all registered domains
   */
  getDomains() {
    return Array.from(this.domains.keys());
  }

  /**
   * Get manifests for a specific domain
   */
  getManifestsByDomain(domain) {
    const toolNames = this.domains.get(domain) || [];
    return toolNames.map(name => this.tools.get(name));
  }

  /**
   * Get all manifests
   */
  getAllManifests() {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * Get tools by domain
   */
  getToolsByDomain(domain) {
    const names = this.domains.get(domain) || [];
    return names.map(name => this.tools.get(name));
  }

  /**
   * Lazy load capability.json for a tool
   */
  async loadCapability(tool) {
    if (this.capabilities.has(tool.name)) {
      return this.capabilities.get(tool.name);
    }

    const capabilityPath = join(tool.path, 'capability.json');

    if (!existsSync(capabilityPath)) {
      throw new Error(`No capability.json found for tool: ${tool.name}`);
    }

    const content = await readFile(capabilityPath, 'utf-8');
    const capability = JSON.parse(content);

    this.capabilities.set(tool.name, capability);
    return capability;
  }

  /**
   * Enable hot reload - watch search paths for changes and re-scan
   */
  enableHotReload(callback = null) {
    if (this.hotReloadEnabled) return;
    this.hotReloadEnabled = true;

    let debounceTimer = null;

    const triggerRescan = async () => {
      // Debounce rapid changes
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        // Clear existing registrations
        this.tools.clear();
        this.domains.clear();
        this.capabilities.clear();

        // Re-scan
        await this.scan();

        if (callback) {
          callback(this);
        }
      }, 100);
    };

    for (const path of this.searchPaths) {
      if (!existsSync(path)) continue;

      try {
        const watcher = watch(path, { recursive: true }, (eventType, filename) => {
          // Only react to manifest/capability changes
          if (filename && (filename.endsWith('.json') || filename.includes('cmp'))) {
            triggerRescan();
          }
        });

        this.watchers.push(watcher);
      } catch (err) {
        console.warn(`Failed to watch ${path}: ${err.message}`);
      }
    }
  }

  /**
   * Disable hot reload and clean up watchers
   */
  disableHotReload() {
    this.hotReloadEnabled = false;
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}

export default Registry;
