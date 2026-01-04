/**
 * Executor - Command building and execution with security hardening
 *
 * Features:
 * - Shell argument escaping to prevent command injection
 * - Command timeout enforcement
 * - Placeholder validation before execution
 * - Execution logging for audit
 */

import { spawn } from 'child_process';
import { sanitizeForShell, validateCommand, validateParams } from './validator.js';

/**
 * Execution error class
 */
export class ExecutionError extends Error {
  constructor(message, code = -32603, data = null) {
    super(message);
    this.name = 'ExecutionError';
    this.code = code;
    this.data = data;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
}

/**
 * Default configuration
 */
const DEFAULT_TIMEOUT = 30000; // 30 seconds

export class Executor {
  constructor(options = {}) {
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.logger = options.logger || console;
    this.enableLogging = options.enableLogging ?? false;
  }

  /**
   * Build a command string from an intent template and context
   * Validates parameters and applies shell escaping
   *
   * @param {Object} intent - The intent definition with command template
   * @param {Object} context - User-provided parameters
   * @param {Object} options - Build options
   * @returns {{ command: string, validation: Object }}
   */
  buildCommand(intent, context, options = {}) {
    const { validateOnly = false } = options;

    // Validate parameters against schema
    const validation = validateParams(context, intent.params || {});

    if (!validation.valid && !validateOnly) {
      throw new ExecutionError(
        `Parameter validation failed: ${validation.errors.map(e => e.message).join('; ')}`,
        -32602,
        { errors: validation.errors }
      );
    }

    let command = intent.command;

    // Use sanitized values for substitution
    const safeContext = validation.sanitized;

    // Replace {param} placeholders with sanitized context values
    for (const [key, value] of Object.entries(safeContext)) {
      const placeholder = `{${key}}`;

      if (command.includes(placeholder)) {
        const formatted = this.formatValue(value);
        // Replace all occurrences of the placeholder
        command = command.split(placeholder).join(formatted);
      }
    }

    // Apply defaults for missing params (already sanitized in validation)
    if (intent.params) {
      for (const [key, def] of Object.entries(intent.params)) {
        const placeholder = `{${key}}`;

        if (command.includes(placeholder) && def.default !== undefined) {
          const safeDefault = sanitizeForShell(def.default);
          command = command.split(placeholder).join(this.formatValue(safeDefault));
        }
      }
    }

    return { command, validation };
  }

  /**
   * Format a value for command line use with shell escaping
   */
  formatValue(value) {
    if (Array.isArray(value)) {
      // For arrays, escape each element and join with spaces
      return value.map(item => this.formatSingleValue(item)).join(' ');
    }

    return this.formatSingleValue(value);
  }

  /**
   * Format a single value with shell escaping
   */
  formatSingleValue(value) {
    if (typeof value === 'string') {
      // Already sanitized, but ensure it's properly quoted if needed
      return sanitizeForShell(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
      return String(value);
    }

    // For other types, stringify and escape
    return sanitizeForShell(String(value));
  }

  /**
   * Validate and execute a pre-built command
   *
   * @param {string} command - The command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Parsed output
   */
  async run(command, options = {}) {
    const timeout = options.timeout || this.timeout;

    // Validate command has no unsubstituted placeholders
    validateCommand(command);

    // Log execution for audit
    if (this.enableLogging) {
      this.logger.info(`[CMP Executor] Running: ${command}`);
    }

    return new Promise((resolve, reject) => {
      // Set CMP_AGENT env var to signal agent mode
      const env = { ...process.env, CMP_AGENT: '1' };

      const child = spawn('sh', ['-c', command], {
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');

        // Force kill after 5 more seconds if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        clearTimeout(timeoutId);

        if (killed) {
          reject(new ExecutionError(
            `Command timed out after ${timeout}ms`,
            -32001,
            { timeout, partial_stdout: stdout.slice(0, 1000) }
          ));
          return;
        }

        if (code !== 0) {
          reject(new ExecutionError(
            `Command failed with exit code ${code}: ${stderr.slice(0, 500)}`,
            -32001,
            { exit_code: code, stderr: stderr.slice(0, 2000) }
          ));
          return;
        }

        if (this.enableLogging) {
          this.logger.info(`[CMP Executor] Completed successfully`);
        }

        // Try to parse as JSON
        try {
          resolve(JSON.parse(stdout));
        } catch {
          // Return raw output if not JSON
          resolve({ raw: stdout.trim() });
        }
      });

      child.on('error', err => {
        clearTimeout(timeoutId);
        reject(new ExecutionError(
          `Failed to spawn command: ${err.message}`,
          -32001,
          { error: err.message }
        ));
      });
    });
  }

  /**
   * Execute an intent with full validation
   *
   * @param {Object} intent - The intent definition
   * @param {Object} context - User-provided parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>}
   */
  async execute(intent, context, options = {}) {
    const { command, validation } = this.buildCommand(intent, context);

    if (!validation.valid) {
      throw new ExecutionError(
        `Validation failed: ${validation.errors.map(e => e.message).join('; ')}`,
        -32602,
        { errors: validation.errors }
      );
    }

    return {
      command,
      output: await this.run(command, options)
    };
  }
}

export default Executor;
