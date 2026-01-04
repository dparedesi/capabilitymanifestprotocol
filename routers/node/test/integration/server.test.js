/**
 * Integration tests for the CMP Server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, handleRequest } from '../../src/server.js';
import { Router } from '../../src/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = join(__dirname, '../fixtures');

describe('Server handleRequest', () => {
  let router;

  beforeAll(async () => {
    router = new Router({
      searchPaths: [FIXTURES_PATH]
    });
    await router.init();
  });

  describe('JSON-RPC protocol', () => {
    it('should reject non-2.0 requests', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '1.0',
        method: 'cmp.domains',
        id: 1
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32600);
    });

    it('should return method not found for unknown methods', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'unknown.method',
        id: 1
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601);
    });

    it('should include cmp version in response', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.domains',
        id: 1
      });

      expect(response.cmp).toBe('0.1.0');
    });

    it('should preserve request id in response', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.domains',
        id: 'test-123'
      });

      expect(response.id).toBe('test-123');
    });
  });

  describe('cmp.domains', () => {
    it('should return list of domains', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.domains',
        id: 1
      });

      expect(response.result).toBeDefined();
      expect(response.result.domains).toContain('test');
    });
  });

  describe('cmp.manifests', () => {
    it('should return all manifests', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.manifests',
        id: 1
      });

      expect(response.result.manifests.length).toBeGreaterThan(0);
    });

    it('should filter by domain', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.manifests',
        params: { domain: 'test' },
        id: 1
      });

      expect(response.result.manifests.every(m => m.domain === 'test')).toBe(true);
    });
  });

  describe('cmp.capabilities', () => {
    it('should return capabilities for a tool', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.capabilities',
        params: { tool: 'mock-tool' },
        id: 1
      });

      expect(response.result.intents).toBeDefined();
      expect(response.result.intents.length).toBeGreaterThan(0);
    });

    it('should require tool parameter', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.capabilities',
        params: {},
        id: 1
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
    });
  });

  describe('cmp.schema', () => {
    it('should return schema for a pattern', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.schema',
        params: { tool: 'mock-tool', pattern: 'echo message' },
        id: 1
      });

      expect(response.result.command).toBeDefined();
      expect(response.result.params).toBeDefined();
    });

    it('should require tool and pattern parameters', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.schema',
        params: { tool: 'mock-tool' },
        id: 1
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
    });
  });

  describe('cmp.intent', () => {
    it('should execute an intent', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.intent',
        params: {
          want: 'echo message',
          context: { message: 'test' }
        },
        id: 1
      });

      expect(response.result.success).toBe(true);
      expect(response.result.output).toBeDefined();
    });

    it('should require want parameter', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.intent',
        params: {},
        id: 1
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
    });

    it('should return error for validation failures', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.intent',
        params: {
          want: 'echo message'
          // missing required message param
        },
        id: 1
      });

      expect(response.error).toBeDefined();
    });
  });

  describe('cmp.context', () => {
    it('should return context snippet', async () => {
      const response = await handleRequest(router, {
        jsonrpc: '2.0',
        method: 'cmp.context',
        id: 1
      });

      expect(response.result.snippet).toBeDefined();
      expect(typeof response.result.snippet).toBe('string');
    });
  });
});

describe('HTTP Server', () => {
  let router;
  let server;
  let port;

  beforeAll(async () => {
    router = new Router({
      searchPaths: [FIXTURES_PATH]
    });
    await router.init();

    server = createServer(router);
    await new Promise(resolve => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise(resolve => {
      server.close(resolve);
    });
  });

  it('should respond to POST requests', async () => {
    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'cmp.domains',
        id: 1
      })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.result.domains).toBeDefined();
  });

  it('should reject non-POST methods', async () => {
    const response = await fetch(`http://localhost:${port}`, {
      method: 'GET'
    });

    expect(response.status).toBe(405);
  });

  it('should handle CORS preflight', async () => {
    const response = await fetch(`http://localhost:${port}`, {
      method: 'OPTIONS'
    });

    expect(response.ok).toBe(true);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should return parse error for invalid JSON', async () => {
    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });

    const data = await response.json();
    expect(data.error.code).toBe(-32700);
  });
});
