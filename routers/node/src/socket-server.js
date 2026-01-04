/**
 * Unix Socket Server for CMP Router
 *
 * Provides a Unix domain socket interface for local IPC,
 * which is faster and more secure than HTTP for local communication.
 */

import { createServer } from 'net';
import { unlinkSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { handleRequest } from './server.js';

/**
 * Create a Unix socket server for the router
 *
 * @param {Router} router - The CMP router instance
 * @param {Object} options - Server options
 * @returns {net.Server} The socket server
 */
export function createSocketServer(router, options = {}) {
  const {
    socketPath = '/tmp/cmp-router.sock',
    onError = console.error,
    onConnection = null
  } = options;

  // Ensure socket directory exists
  const socketDir = dirname(socketPath);
  if (!existsSync(socketDir)) {
    mkdirSync(socketDir, { recursive: true });
  }

  // Remove existing socket file if present
  if (existsSync(socketPath)) {
    try {
      unlinkSync(socketPath);
    } catch (err) {
      onError(`Failed to remove existing socket: ${err.message}`);
    }
  }

  const server = createServer(connection => {
    if (onConnection) {
      onConnection(connection);
    }

    let buffer = '';

    connection.on('data', async data => {
      buffer += data.toString();

      // Process complete JSON-RPC messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const request = JSON.parse(line);
          const response = await handleRequest(router, request);
          connection.write(JSON.stringify(response) + '\n');
        } catch (err) {
          const errorResponse = {
            jsonrpc: '2.0',
            error: {
              code: -32700,
              message: 'Parse error',
              data: { error: err.message }
            },
            id: null
          };
          connection.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    });

    connection.on('error', err => {
      onError(`Socket connection error: ${err.message}`);
    });
  });

  server.on('error', err => {
    onError(`Socket server error: ${err.message}`);
  });

  // Clean up socket on close
  server.on('close', () => {
    if (existsSync(socketPath)) {
      try {
        unlinkSync(socketPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  return {
    server,
    listen: () => {
      return new Promise((resolve, reject) => {
        server.listen(socketPath, () => {
          resolve(socketPath);
        });
        server.once('error', reject);
      });
    },
    close: () => {
      return new Promise(resolve => {
        server.close(() => {
          if (existsSync(socketPath)) {
            try {
              unlinkSync(socketPath);
            } catch {
              // Ignore
            }
          }
          resolve();
        });
      });
    }
  };
}

export default createSocketServer;
