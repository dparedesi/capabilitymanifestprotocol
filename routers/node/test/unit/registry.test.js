import { describe, it, expect, beforeEach } from 'vitest';
import { Registry } from '../../src/registry.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to fixtures directory
// routers/node/test/unit -> routers/node/test/fixtures
const FIXTURES_PATH = join(__dirname, '../fixtures');
const MOCK_TOOL_PATH = join(FIXTURES_PATH, 'mock-tool');

describe('Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new Registry();
  });

  describe('constructor', () => {
    it('should initialize with default search paths', () => {
      expect(registry.searchPaths.length).toBeGreaterThan(0);
      expect(registry.tools).toBeInstanceOf(Map);
      expect(registry.domains).toBeInstanceOf(Map);
      expect(registry.capabilities).toBeInstanceOf(Map);
    });

    it('should accept additional search paths', () => {
      const customPath = '/custom/path';
      const reg = new Registry([customPath]);
      expect(reg.searchPaths).toContain(customPath);
    });
  });

  describe('register', () => {
    it('should register a tool and update domains map', () => {
      const tool = {
        name: 'test-tool',
        domain: 'test-domain',
        version: '1.0.0',
        path: '/path/to/tool'
      };

      registry.register(tool);

      expect(registry.getTool('test-tool')).toEqual(tool);

      const domains = registry.getDomains();
      expect(domains).toContain('test-domain');

      const toolsInDomain = registry.getToolsByDomain('test-domain');
      expect(toolsInDomain).toContainEqual(tool);
    });
  });

  describe('tryRegister', () => {
    it('should successfully register a valid tool from path', async () => {
      const result = await registry.tryRegister(MOCK_TOOL_PATH);
      expect(result).toBe(true);

      const tool = registry.getTool('mock-tool');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('mock-tool');
      expect(tool.domain).toBe('test');
      expect(tool.path).toContain('mock-tool/cmp');
    });

    it('should return false for invalid path', async () => {
      const result = await registry.tryRegister('/path/does/not/exist/999');
      expect(result).toBe(false);
    });
  });

  describe('scan', () => {
    it('should scan search paths and register found tools', async () => {
      // Create registry with fixtures path
      const reg = new Registry([FIXTURES_PATH]);

      await reg.scan();

      const tool = reg.getTool('mock-tool');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('mock-tool');
      expect(tool.domain).toBe('test');
    });
  });

  describe('Accessors', () => {
    const tool1 = { name: 'tool1', domain: 'domainA', path: '/p1' };
    const tool2 = { name: 'tool2', domain: 'domainA', path: '/p2' };
    const tool3 = { name: 'tool3', domain: 'domainB', path: '/p3' };

    beforeEach(() => {
      registry.register(tool1);
      registry.register(tool2);
      registry.register(tool3);
    });

    describe('getDomains', () => {
      it('should return all registered domains', () => {
        const domains = registry.getDomains();
        expect(domains).toHaveLength(2);
        expect(domains).toContain('domainA');
        expect(domains).toContain('domainB');
      });
    });

    describe('getTool', () => {
      it('should return tool by name', () => {
        expect(registry.getTool('tool1')).toEqual(tool1);
      });

      it('should return undefined for unknown tool', () => {
        expect(registry.getTool('unknown')).toBeUndefined();
      });
    });

    describe('getAllManifests', () => {
      it('should return all registered tools', () => {
        const manifests = registry.getAllManifests();
        expect(manifests).toHaveLength(3);
        expect(manifests).toContainEqual(tool1);
        expect(manifests).toContainEqual(tool2);
        expect(manifests).toContainEqual(tool3);
      });
    });

    describe('getManifestsByDomain', () => {
      it('should return tools for a specific domain', () => {
        const domainATools = registry.getManifestsByDomain('domainA');
        expect(domainATools).toHaveLength(2);
        expect(domainATools).toContainEqual(tool1);
        expect(domainATools).toContainEqual(tool2);

        const domainBTools = registry.getManifestsByDomain('domainB');
        expect(domainBTools).toHaveLength(1);
        expect(domainBTools).toContainEqual(tool3);
      });

      it('should return empty array for unknown domain', () => {
        expect(registry.getManifestsByDomain('unknown')).toEqual([]);
      });
    });

    describe('getToolsByDomain', () => {
      it('should return tools for a specific domain', () => {
        const domainATools = registry.getToolsByDomain('domainA');
        expect(domainATools).toHaveLength(2);
        expect(domainATools).toContainEqual(tool1);
      });
    });
  });

  describe('loadCapability', () => {
    it('should load capability.json for a registered tool', async () => {
      await registry.tryRegister(MOCK_TOOL_PATH);
      const tool = registry.getTool('mock-tool');

      const capability = await registry.loadCapability(tool);
      expect(capability).toBeDefined();
      expect(capability.intents).toBeDefined();
      expect(Array.isArray(capability.intents)).toBe(true);
    });

    it('should cache capability after loading', async () => {
      await registry.tryRegister(MOCK_TOOL_PATH);
      const tool = registry.getTool('mock-tool');

      const cap1 = await registry.loadCapability(tool);
      const cap2 = await registry.loadCapability(tool);

      expect(cap1).toBe(cap2); // Same object reference
    });

    it('should throw error if capability.json is missing', async () => {
      const tool = {
        name: 'broken-tool',
        path: '/invalid/path'
      };

      await expect(registry.loadCapability(tool)).rejects.toThrow();
    });
  });
});
