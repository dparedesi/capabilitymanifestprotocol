/**
 * Integration tests for the CMP Router
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Router, CMPError, ValidationError, ErrorCodes } from '../../src/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = join(__dirname, '../fixtures');

describe('Router Integration', () => {
  let router;

  beforeAll(async () => {
    router = new Router({
      searchPaths: [FIXTURES_PATH]
    });
    await router.init();
  });

  describe('init', () => {
    it('should scan and find tools in search paths', async () => {
      const domains = router.domains();
      expect(domains.domains).toContain('test');
    });
  });

  describe('domains', () => {
    it('should return list of available domains', () => {
      const result = router.domains();
      expect(result).toHaveProperty('domains');
      expect(Array.isArray(result.domains)).toBe(true);
    });
  });

  describe('manifests', () => {
    it('should return all manifests when no domain specified', () => {
      const result = router.manifests();
      expect(result).toHaveProperty('manifests');
      expect(result.manifests.length).toBeGreaterThan(0);
    });

    it('should return manifests for a specific domain', () => {
      const result = router.manifests('test');
      expect(result.manifests.length).toBeGreaterThan(0);
      expect(result.manifests[0].domain).toBe('test');
    });

    it('should return empty array for unknown domain', () => {
      const result = router.manifests('nonexistent');
      expect(result.manifests).toEqual([]);
    });
  });

  describe('capabilities', () => {
    it('should return capabilities for a valid tool', async () => {
      const result = await router.capabilities('mock-tool');
      expect(result).toHaveProperty('intents');
      expect(Array.isArray(result.intents)).toBe(true);
      expect(result.intents.length).toBeGreaterThan(0);
    });

    it('should throw ToolNotFoundError for unknown tool', async () => {
      await expect(router.capabilities('nonexistent')).rejects.toThrow();
    });

    it('should include confirm and destructive flags', async () => {
      const result = await router.capabilities('mock-tool');
      const destructiveIntent = result.intents.find(i => i.destructive === true);
      expect(destructiveIntent).toBeDefined();
      expect(destructiveIntent.confirm).toBe(true);
    });
  });

  describe('schema', () => {
    it('should return full schema for a matching pattern', async () => {
      const result = await router.schema('mock-tool', 'echo message');
      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('params');
      expect(result.params.message).toBeDefined();
    });

    it('should throw for unknown tool', async () => {
      await expect(router.schema('nonexistent', 'echo')).rejects.toThrow();
    });

    it('should throw for non-matching pattern', async () => {
      await expect(router.schema('mock-tool', 'unknown pattern xyz')).rejects.toThrow();
    });
  });

  describe('intent', () => {
    it('should execute a simple intent', async () => {
      const result = await router.intent({
        want: 'echo message',
        context: { message: 'hello' }
      });

      expect(result.success).toBe(true);
      expect(result.tool).toBe('mock-tool');
      expect(result.output).toBeDefined();
    });

    it('should use default values when not provided', async () => {
      const result = await router.intent({
        want: 'greet user'
      });

      expect(result.success).toBe(true);
      expect(result.output.raw).toContain('World');
    });

    it('should use provided values over defaults', async () => {
      const result = await router.intent({
        want: 'greet user',
        context: { name: 'Alice' }
      });

      expect(result.success).toBe(true);
      expect(result.output.raw).toContain('Alice');
    });

    it('should require confirmation for destructive actions', async () => {
      const result = await router.intent({
        want: 'delete file',
        context: { path: '/tmp/test' }
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('confirmation_required');
      expect(result.destructive).toBe(true);
    });

    it('should throw NoMatchError for unknown intent', async () => {
      await expect(router.intent({
        want: 'completely unknown action xyz123'
      })).rejects.toThrow();
    });

    it('should throw for missing required parameters', async () => {
      await expect(router.intent({
        want: 'echo message'
        // missing message parameter
      })).rejects.toThrow();
    });

    it('should throw for invalid enum value', async () => {
      await expect(router.intent({
        want: 'select mode',
        context: { mode: 'invalid' }
      })).rejects.toThrow();
    });

    it('should accept valid enum value', async () => {
      const result = await router.intent({
        want: 'select mode',
        context: { mode: 'debug' }
      });

      expect(result.success).toBe(true);
      expect(result.output.raw).toContain('debug');
    });

    it('should handle array parameters', async () => {
      const result = await router.intent({
        want: 'process items',
        context: { items: ['a', 'b', 'c'] }
      });

      expect(result.success).toBe(true);
    });

    it('should sanitize shell injection attempts', async () => {
      const result = await router.intent({
        want: 'echo message',
        context: { message: 'test; rm -rf /' }
      });

      expect(result.success).toBe(true);
      // The malicious command should be escaped, not executed
      expect(result.output.raw).toContain('test');
    });
  });

  describe('contextSnippet', () => {
    it('should generate a context snippet', () => {
      const snippet = router.contextSnippet();
      expect(typeof snippet).toBe('string');
      expect(snippet).toContain('test');
      expect(snippet).toContain('mock-tool');
    });
  });
});

describe('Router Error Handling', () => {
  let router;

  beforeAll(async () => {
    router = new Router({
      searchPaths: [FIXTURES_PATH]
    });
    await router.init();
  });

  it('should throw CMPError with proper code for invalid want', async () => {
    try {
      await router.intent({ want: null });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.code).toBe(ErrorCodes.INVALID_PARAMS);
    }
  });

  it('should include error data in CMPError', async () => {
    try {
      await router.capabilities('nonexistent');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.data).toBeDefined();
      expect(err.data.tool).toBe('nonexistent');
    }
  });
});
