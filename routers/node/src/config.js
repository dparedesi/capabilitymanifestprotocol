/**
 * Configuration system for CMP Router
 *
 * Loads configuration from:
 * 1. Default values
 * 2. ~/.cmp/config.json (if exists)
 * 3. Environment variables (highest priority)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Default configuration values
 */
export const defaultConfig = {
  // Execution
  timeout: 30000,              // Command timeout in ms

  // HTTP server
  httpPort: 7890,
  httpHost: '127.0.0.1',

  // Unix socket
  socketPath: join(homedir(), '.cmp', 'router.sock'),
  enableSocket: false,

  // Tool discovery
  searchPaths: [],

  // Security
  allowList: null,             // null = allow all tools
  denyList: [],                // Tools to explicitly deny

  // Logging
  enableLogging: false,
  logLevel: 'info',

  // Rate limiting (future)
  rateLimit: null
};

/**
 * Environment variable mappings
 */
const ENV_MAPPINGS = {
  CMP_TIMEOUT: { key: 'timeout', parse: parseInt },
  CMP_HTTP_PORT: { key: 'httpPort', parse: parseInt },
  CMP_HTTP_HOST: { key: 'httpHost', parse: String },
  CMP_SOCKET_PATH: { key: 'socketPath', parse: String },
  CMP_ENABLE_SOCKET: { key: 'enableSocket', parse: v => v === 'true' || v === '1' },
  CMP_TOOL_PATH: { key: 'searchPaths', parse: v => v.split(':').filter(Boolean) },
  CMP_ENABLE_LOGGING: { key: 'enableLogging', parse: v => v === 'true' || v === '1' },
  CMP_LOG_LEVEL: { key: 'logLevel', parse: String }
};

/**
 * Load configuration from file
 *
 * @param {string} configPath - Path to config file
 * @returns {Object} Parsed configuration or empty object
 */
export function loadConfigFile(configPath) {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(`Failed to load config from ${configPath}: ${err.message}`);
    return {};
  }
}

/**
 * Load configuration from environment variables
 *
 * @returns {Object} Configuration from environment
 */
export function loadEnvConfig() {
  const config = {};

  for (const [envVar, mapping] of Object.entries(ENV_MAPPINGS)) {
    const value = process.env[envVar];
    if (value !== undefined) {
      config[mapping.key] = mapping.parse(value);
    }
  }

  return config;
}

/**
 * Merge configurations with proper precedence
 *
 * @param {...Object} configs - Configurations to merge (later overrides earlier)
 * @returns {Object} Merged configuration
 */
export function mergeConfigs(...configs) {
  const result = { ...defaultConfig };

  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== null) {
        // Special handling for arrays - append rather than replace
        if (key === 'searchPaths' && Array.isArray(value)) {
          result.searchPaths = [...result.searchPaths, ...value];
        } else {
          result[key] = value;
        }
      }
    }
  }

  return result;
}

/**
 * Load complete configuration
 *
 * Priority (highest to lowest):
 * 1. Environment variables
 * 2. Config file (~/.cmp/config.json)
 * 3. Default values
 *
 * @param {Object} overrides - Direct overrides (highest priority)
 * @returns {Object} Complete configuration
 */
export function loadConfig(overrides = {}) {
  const configPath = join(homedir(), '.cmp', 'config.json');

  const fileConfig = loadConfigFile(configPath);
  const envConfig = loadEnvConfig();

  return mergeConfigs(defaultConfig, fileConfig, envConfig, overrides);
}

/**
 * Validate configuration
 *
 * @param {Object} config - Configuration to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig(config) {
  const errors = [];

  if (typeof config.timeout !== 'number' || config.timeout <= 0) {
    errors.push('timeout must be a positive number');
  }

  if (typeof config.httpPort !== 'number' || config.httpPort < 0 || config.httpPort > 65535) {
    errors.push('httpPort must be a valid port number (0-65535)');
  }

  if (config.allowList !== null && !Array.isArray(config.allowList)) {
    errors.push('allowList must be null or an array of tool names');
  }

  if (!Array.isArray(config.denyList)) {
    errors.push('denyList must be an array of tool names');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  defaultConfig,
  loadConfig,
  loadConfigFile,
  loadEnvConfig,
  mergeConfigs,
  validateConfig
};
