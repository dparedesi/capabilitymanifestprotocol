/**
 * CMP Router - Reference Implementation
 *
 * The router is the central component that:
 * 1. Discovers and registers tools
 * 2. Matches intents to capabilities
 * 3. Resolves schemas on-demand
 * 4. Validates parameters before execution
 * 5. Executes tools and returns structured results
 */

import { Registry } from './registry.js';
import { Matcher } from './matcher.js';
import { Executor, ExecutionError } from './executor.js';
import { ValidationError, validateParams } from './validator.js';

/**
 * JSON-RPC Error Codes per SPEC.md §5.3
 */
export const ErrorCodes = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // CMP-specific errors
  NO_MATCH: -32000,
  TOOL_NOT_FOUND: -32001,
  CAPABILITY_NOT_FOUND: -32002,
  EXECUTION_FAILED: -32003,
  AMBIGUOUS_INTENT: -32004,
  CONFIRMATION_REQUIRED: -32005
};

/**
 * Base CMP Error class with JSON-RPC error codes
 */
export class CMPError extends Error {
  constructor(code, message, data = null) {
    super(message);
    this.name = 'CMPError';
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
 * Tool not found error
 */
export class ToolNotFoundError extends CMPError {
  constructor(toolName) {
    super(ErrorCodes.TOOL_NOT_FOUND, `Tool not found: ${toolName}`, { tool: toolName });
    this.name = 'ToolNotFoundError';
  }
}

/**
 * No matching intent error
 */
export class NoMatchError extends CMPError {
  constructor(intent) {
    super(ErrorCodes.NO_MATCH, `No tool matches intent: ${intent}`, { intent });
    this.name = 'NoMatchError';
  }
}

/**
 * Ambiguous intent error
 */
export class AmbiguousIntentError extends CMPError {
  constructor(intent, candidates) {
    super(
      ErrorCodes.AMBIGUOUS_INTENT,
      `Ambiguous intent: ${intent}`,
      { intent, candidates }
    );
    this.name = 'AmbiguousIntentError';
  }
}

/**
 * Confirmation required error
 */
export class ConfirmationRequiredError extends CMPError {
  constructor(tool, command, message = 'This action requires confirmation') {
    super(
      ErrorCodes.CONFIRMATION_REQUIRED,
      message,
      { tool, command, requires_confirm: true }
    );
    this.name = 'ConfirmationRequiredError';
  }
}

export class Router {
  constructor(options = {}) {
    this.registry = new Registry(options.searchPaths);
    this.matcher = new Matcher();
    this.executor = new Executor({
      timeout: options.timeout,
      logger: options.logger,
      enableLogging: options.enableLogging
    });
    this.options = options;
  }

  /**
   * Initialize the router - scan for tools and build the registry
   */
  async init() {
    try {
      await this.registry.scan();
      return this;
    } catch (err) {
      throw new CMPError(
        ErrorCodes.INTERNAL_ERROR,
        `Failed to initialize router: ${err.message}`,
        { error: err.message }
      );
    }
  }

  /**
   * List available domains
   */
  domains() {
    return {
      domains: this.registry.getDomains()
    };
  }

  /**
   * Get manifests for a domain (or all domains)
   */
  manifests(domain = null) {
    const manifests = domain
      ? this.registry.getManifestsByDomain(domain)
      : this.registry.getAllManifests();

    return { manifests };
  }

  /**
   * Get capabilities for a specific tool
   */
  async capabilities(toolName) {
    const tool = this.registry.getTool(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    try {
      // Lazy load capability.json
      const capability = await this.registry.loadCapability(tool);

      // Return summarized intents (not full schemas)
      return {
        intents: capability.intents.map(intent => ({
          patterns: intent.patterns,
          confirm: intent.confirm || false,
          destructive: intent.destructive || false
        }))
      };
    } catch (err) {
      throw new CMPError(
        ErrorCodes.CAPABILITY_NOT_FOUND,
        `Failed to load capabilities for tool: ${toolName}`,
        { tool: toolName, error: err.message }
      );
    }
  }

  /**
   * Get full schema for a specific intent
   */
  async schema(toolName, pattern) {
    const tool = this.registry.getTool(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    try {
      const capability = await this.registry.loadCapability(tool);
      const intent = this.matcher.findIntent(capability.intents, pattern);

      if (!intent) {
        throw new CMPError(
          ErrorCodes.NO_MATCH,
          `No intent matches pattern: ${pattern}`,
          { tool: toolName, pattern }
        );
      }

      return intent;
    } catch (err) {
      if (err instanceof CMPError) throw err;
      throw new CMPError(
        ErrorCodes.INTERNAL_ERROR,
        `Failed to get schema: ${err.message}`,
        { tool: toolName, pattern, error: err.message }
      );
    }
  }

  /**
   * Execute an intent
   */
  async intent(params) {
    const { want, context = {}, confirm = false } = params;

    if (!want || typeof want !== 'string') {
      throw new CMPError(
        ErrorCodes.INVALID_PARAMS,
        'Missing or invalid "want" parameter',
        { received: typeof want }
      );
    }

    try {
      // 1. Match intent to tool
      const match = await this.matcher.match(want, this.registry);

      if (!match) {
        throw new NoMatchError(want);
      }

      if (match.ambiguous) {
        throw new AmbiguousIntentError(want, match.candidates);
      }

      // 2. Load capability and find specific intent
      const capability = await this.registry.loadCapability(match.tool);
      const intent = this.matcher.findIntent(capability.intents, want);

      if (!intent) {
        throw new NoMatchError(want);
      }

      // 3. Validate parameters before proceeding
      const validation = validateParams(context, intent.params || {});
      if (!validation.valid) {
        throw new ValidationError(
          `Parameter validation failed: ${validation.errors.map(e => e.message).join('; ')}`,
          validation.errors
        );
      }

      // 4. Build command with sanitized parameters
      const { command } = this.executor.buildCommand(intent, context);

      // 5. Check confirmation requirement
      if (intent.confirm && !confirm) {
        return {
          success: false,
          reason: 'confirmation_required',
          tool: match.tool.name,
          command,
          intent: intent.patterns[0],
          destructive: intent.destructive || false,
          message: `This action requires confirmation. Set confirm: true to proceed.`
        };
      }

      // 6. Execute
      const output = await this.executor.run(command);

      return {
        success: true,
        tool: match.tool.name,
        command,
        output
      };

    } catch (err) {
      // Re-throw CMP errors as-is
      if (err instanceof CMPError || err instanceof ValidationError || err instanceof ExecutionError) {
        throw err;
      }

      // Wrap unknown errors
      throw new CMPError(
        ErrorCodes.INTERNAL_ERROR,
        `Intent execution failed: ${err.message}`,
        { want, error: err.message }
      );
    }
  }

  /**
   * Generate context snippet for AI agents
   */
  contextSnippet() {
    const domains = this.registry.getDomains();
    const manifests = this.registry.getAllManifests();

    const toolSummaries = manifests
      .map(m => `- ${m.name} (${m.domain}): ${m.summary}`)
      .join('\n');

    return `You have access to a Capability Router with ${manifests.length} tools.

Available domains: ${domains.join(', ')}

Tools:
${toolSummaries}

To use tools, send intents:
{ "want": "check email" }
{ "want": "delete emails", "context": { "ids": [...] }, "confirm": true }

Query cmp.capabilities for intent patterns. Query cmp.schema for parameters.`;
  }
}

// Re-export errors and utilities
export { ValidationError } from './validator.js';
export { ExecutionError } from './executor.js';

export default Router;
