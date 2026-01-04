/**
 * Validator - Parameter validation and shell sanitization
 *
 * Validates intent parameters against capability schema and
 * provides shell escaping to prevent command injection.
 */

/**
 * JSON-RPC error codes per SPEC.md §5.3
 */
export const ErrorCodes = {
  INVALID_PARAMS: -32602,
  VALIDATION_ERROR: -32602,
  MISSING_REQUIRED: -32602,
  TYPE_MISMATCH: -32602
};

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.code = ErrorCodes.VALIDATION_ERROR;
    this.errors = errors;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: { errors: this.errors }
    };
  }
}

/**
 * Validate parameters against an intent schema
 *
 * @param {Object} context - The provided context/parameters
 * @param {Object} schema - The intent params schema from capability.json
 * @returns {{ valid: boolean, errors: Array, sanitized: Object }}
 */
export function validateParams(context, schema) {
  const errors = [];
  const sanitized = {};

  if (!schema || Object.keys(schema).length === 0) {
    // No schema means no validation needed
    return { valid: true, errors: [], sanitized: context };
  }

  // Check required parameters
  const missingRequired = checkRequired(context, schema);
  if (missingRequired.length > 0) {
    errors.push(...missingRequired.map(param => ({
      type: 'missing_required',
      param,
      message: `Required parameter '${param}' is missing`
    })));
  }

  // Validate and sanitize each provided parameter
  for (const [key, value] of Object.entries(context)) {
    const paramSchema = schema[key];

    if (!paramSchema) {
      // Unknown parameter - pass through but sanitize
      sanitized[key] = sanitizeValue(value);
      continue;
    }

    // Type validation
    const typeResult = validateType(value, paramSchema.type);
    if (!typeResult.valid) {
      errors.push({
        type: 'type_mismatch',
        param: key,
        expected: paramSchema.type,
        received: typeof value,
        message: `Parameter '${key}' expected type '${paramSchema.type}', got '${typeof value}'`
      });
      continue;
    }

    // Enum validation
    if (paramSchema.enum && !paramSchema.enum.includes(value)) {
      errors.push({
        type: 'invalid_enum',
        param: key,
        expected: paramSchema.enum,
        received: value,
        message: `Parameter '${key}' must be one of: ${paramSchema.enum.join(', ')}`
      });
      continue;
    }

    // Store sanitized value
    sanitized[key] = typeResult.coerced !== undefined
      ? sanitizeValue(typeResult.coerced)
      : sanitizeValue(value);
  }

  // Apply defaults for missing optional params
  for (const [key, paramSchema] of Object.entries(schema)) {
    if (!(key in sanitized) && paramSchema.default !== undefined) {
      sanitized[key] = sanitizeValue(paramSchema.default);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Check for missing required parameters
 *
 * @param {Object} context - The provided context
 * @param {Object} schema - The params schema
 * @returns {string[]} Array of missing required parameter names
 */
export function checkRequired(context, schema) {
  const missing = [];

  for (const [key, paramSchema] of Object.entries(schema)) {
    if (paramSchema.required === true && !(key in context)) {
      missing.push(key);
    }
  }

  return missing;
}

/**
 * Validate and optionally coerce a value to the expected type
 *
 * @param {*} value - The value to validate
 * @param {string} type - Expected type: string, integer, boolean, array<string>, array<integer>
 * @returns {{ valid: boolean, coerced?: * }}
 */
export function validateType(value, type) {
  if (!type) {
    return { valid: true };
  }

  switch (type) {
    case 'string':
      if (typeof value === 'string') return { valid: true };
      if (typeof value === 'number') return { valid: true, coerced: String(value) };
      return { valid: false };

    case 'integer':
      if (Number.isInteger(value)) return { valid: true };
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && String(parsed) === value) {
          return { valid: true, coerced: parsed };
        }
      }
      return { valid: false };

    case 'number':
      if (typeof value === 'number' && !isNaN(value)) return { valid: true };
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) return { valid: true, coerced: parsed };
      }
      return { valid: false };

    case 'boolean':
      if (typeof value === 'boolean') return { valid: true };
      if (value === 'true') return { valid: true, coerced: true };
      if (value === 'false') return { valid: true, coerced: false };
      return { valid: false };

    case 'array<string>':
      if (!Array.isArray(value)) return { valid: false };
      if (value.every(item => typeof item === 'string')) return { valid: true };
      // Try to coerce all items to strings
      const stringArray = value.map(item => String(item));
      return { valid: true, coerced: stringArray };

    case 'array<integer>':
      if (!Array.isArray(value)) return { valid: false };
      const intArray = [];
      for (const item of value) {
        if (Number.isInteger(item)) {
          intArray.push(item);
        } else if (typeof item === 'string') {
          const parsed = parseInt(item, 10);
          if (isNaN(parsed)) return { valid: false };
          intArray.push(parsed);
        } else {
          return { valid: false };
        }
      }
      return { valid: true, coerced: intArray };

    case 'array':
      return { valid: Array.isArray(value) };

    case 'object':
      return { valid: typeof value === 'object' && value !== null && !Array.isArray(value) };

    default:
      // Unknown type, pass through
      return { valid: true };
  }
}

/**
 * Sanitize a value for safe shell usage
 * Prevents command injection attacks
 *
 * @param {*} value - The value to sanitize
 * @returns {*} Sanitized value
 */
export function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }

  if (typeof value === 'string') {
    return sanitizeForShell(value);
  }

  // Numbers, booleans, etc. are safe
  return value;
}

/**
 * Escape a string for safe shell usage
 * Uses single quotes with proper escaping
 *
 * @param {string} value - The string to escape
 * @returns {string} Shell-safe escaped string
 */
export function sanitizeForShell(value) {
  if (typeof value !== 'string') {
    return String(value);
  }

  // If the string is simple (alphanumeric, dashes, underscores, dots), return as-is
  if (/^[a-zA-Z0-9_.\-/]+$/.test(value)) {
    return value;
  }

  // Otherwise, wrap in single quotes and escape any existing single quotes
  // Shell escaping: replace ' with '\'' (end quote, escaped quote, start quote)
  const escaped = value.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

/**
 * Check if a command string has unsubstituted placeholders
 *
 * @param {string} command - The command to check
 * @returns {{ hasPlaceholders: boolean, placeholders: string[] }}
 */
export function checkPlaceholders(command) {
  const matches = command.match(/\{(\w+)\}/g) || [];
  return {
    hasPlaceholders: matches.length > 0,
    placeholders: matches.map(m => m.slice(1, -1)) // Remove { and }
  };
}

/**
 * Validate that a command is ready for execution
 * (no unsubstituted placeholders)
 *
 * @param {string} command - The command to validate
 * @throws {ValidationError} If command has unsubstituted placeholders
 */
export function validateCommand(command) {
  const { hasPlaceholders, placeholders } = checkPlaceholders(command);

  if (hasPlaceholders) {
    throw new ValidationError(
      `Command has unsubstituted placeholders: ${placeholders.join(', ')}`,
      placeholders.map(p => ({
        type: 'unsubstituted_placeholder',
        param: p,
        message: `Parameter '${p}' was not provided and has no default`
      }))
    );
  }

  return true;
}

export default {
  validateParams,
  validateType,
  checkRequired,
  sanitizeForShell,
  sanitizeValue,
  checkPlaceholders,
  validateCommand,
  ValidationError,
  ErrorCodes
};
