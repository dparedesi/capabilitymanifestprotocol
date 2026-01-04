/**
 * CMP Router HTTP Server
 *
 * Provides a JSON-RPC 2.0 interface to the router
 */

import { createServer as createHttpServer } from 'http';

export function createServer(router) {
  return createHttpServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Parse body
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    let request;
    try {
      request = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null
      }));
      return;
    }

    // Handle JSON-RPC request
    const response = await handleRequest(router, request);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  });
}

export async function handleRequest(router, request) {
  const { jsonrpc, method, params = {}, id } = request;

  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid request: must be JSON-RPC 2.0' },
      id
    };
  }

  try {
    let result;

    switch (method) {
      case 'cmp.domains':
        result = router.domains();
        break;

      case 'cmp.manifests':
        result = router.manifests(params.domain);
        break;

      case 'cmp.capabilities':
        if (!params.tool) {
          throw { code: -32602, message: 'Missing required param: tool' };
        }
        result = await router.capabilities(params.tool);
        break;

      case 'cmp.schema':
        if (!params.tool || !params.pattern) {
          throw { code: -32602, message: 'Missing required params: tool, pattern' };
        }
        result = await router.schema(params.tool, params.pattern);
        break;

      case 'cmp.intent':
        if (!params.want) {
          throw { code: -32602, message: 'Missing required param: want' };
        }
        result = await router.intent(params);
        break;

      case 'cmp.context':
        result = { snippet: router.contextSnippet() };
        break;

      default:
        throw { code: -32601, message: `Method not found: ${method}` };
    }

    return {
      jsonrpc: '2.0',
      result,
      id,
      cmp: '0.1.0'
    };

  } catch (err) {
    return {
      jsonrpc: '2.0',
      error: {
        code: err.code || -32000,
        message: err.message,
        data: err.data
      },
      id,
      cmp: '0.1.0'
    };
  }
}

export default createServer;
