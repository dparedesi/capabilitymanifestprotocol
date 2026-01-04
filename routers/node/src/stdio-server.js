/**
 * Stdio Server for CMP Router
 *
 * Provides a stdio-based interface for embedded use,
 * where an AI tool spawns the router as a subprocess.
 *
 * Communication is newline-delimited JSON-RPC over stdin/stdout.
 */

import { createInterface } from 'readline';
import { handleRequest } from './server.js';

/**
 * Start the stdio server
 *
 * @param {Router} router - The CMP router instance
 * @param {Object} options - Server options
 * @returns {Object} Server control interface
 */
export function createStdioServer(router, options = {}) {
  const {
    input = process.stdin,
    output = process.stdout,
    onError = console.error
  } = options;

  let running = false;

  const rl = createInterface({
    input,
    output: null, // We'll write to output manually
    terminal: false
  });

  /**
   * Send a response
   */
  function send(response) {
    output.write(JSON.stringify(response) + '\n');
  }

  /**
   * Handle incoming line
   */
  async function handleLine(line) {
    if (!line.trim()) return;

    let request;
    try {
      request = JSON.parse(line);
    } catch (err) {
      send({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null
      });
      return;
    }

    const response = await handleRequest(router, request);
    send(response);
  }

  return {
    /**
     * Start listening for requests
     */
    start() {
      if (running) return;
      running = true;

      rl.on('line', handleLine);

      rl.on('close', () => {
        running = false;
      });

      rl.on('error', err => {
        onError(`Stdio error: ${err.message}`);
      });

      // Signal ready
      send({
        jsonrpc: '2.0',
        method: 'cmp.ready',
        params: { version: '0.1.0' }
      });
    },

    /**
     * Stop the server
     */
    stop() {
      running = false;
      rl.close();
    },

    /**
     * Check if running
     */
    isRunning() {
      return running;
    }
  };
}

export default createStdioServer;
