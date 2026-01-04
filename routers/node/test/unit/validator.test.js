import { describe, it, expect } from 'vitest';
import {
  validateParams,
  validateType,
  checkRequired,
  sanitizeForShell,
  sanitizeValue,
  checkPlaceholders,
  validateCommand,
  ValidationError,
  ErrorCodes
} from '../../src/validator.js';

describe('Validator Module', () => {
  describe('validateParams', () => {
    it('should pass with empty schema', () => {
      const result = validateParams({ any: 'thing' }, {});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toEqual({ any: 'thing' });
    });

    it('should validate correct parameters against schema', () => {
      const schema = {
        name: { type: 'string' },
        age: { type: 'integer' }
      };
      const context = { name: 'Alice', age: 30 };

      const result = validateParams(context, schema);

      expect(result.valid).toBe(true);
      expect(result.sanitized.name).toBe('Alice');
      expect(result.sanitized.age).toBe(30);
    });

    it('should fail when required parameters are missing', () => {
      const schema = {
        requiredParam: { type: 'string', required: true },
        optionalParam: { type: 'string' }
      };
      const context = { optionalParam: 'here' };

      const result = validateParams(context, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        type: 'missing_required',
        param: 'requiredParam'
      });
    });

    it('should fail when parameter type is incorrect', () => {
      const schema = {
        count: { type: 'integer' }
      };
      const context = { count: 'not-a-number' };

      const result = validateParams(context, schema);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({
        type: 'type_mismatch',
        param: 'count'
      });
    });

    it('should validate enum values', () => {
      const schema = {
        status: { type: 'string', enum: ['pending', 'active', 'done'] }
      };

      const validResult = validateParams({ status: 'active' }, schema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validateParams({ status: 'unknown' }, schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0]).toMatchObject({
        type: 'invalid_enum',
        param: 'status'
      });
    });

    it('should apply default values', () => {
      const schema = {
        mode: { type: 'string', default: 'normal' },
        verbosity: { type: 'integer', default: 1 }
      };

      const result = validateParams({}, schema);

      expect(result.valid).toBe(true);
      expect(result.sanitized.mode).toBe('normal');
      expect(result.sanitized.verbosity).toBe(1);
    });

    it('should prioritize provided value over default', () => {
      const schema = {
        mode: { type: 'string', default: 'normal' }
      };

      const result = validateParams({ mode: 'turbo' }, schema);

      expect(result.valid).toBe(true);
      expect(result.sanitized.mode).toBe('turbo');
    });

    it('should sanitize unknown parameters', () => {
      const schema = {
        known: { type: 'string' }
      };
      const context = {
        known: 'ok',
        unknown: 'value with spaces'
      };

      const result = validateParams(context, schema);

      expect(result.valid).toBe(true);
      expect(result.sanitized.unknown).toBe("'value with spaces'");
    });

    it('should coerce types and sanitize', () => {
      const schema = {
        count: { type: 'integer' }
      };
      // '42' string should be coerced to 42 integer
      const result = validateParams({ count: '42' }, schema);

      expect(result.valid).toBe(true);
      expect(result.sanitized.count).toBe(42);
    });
  });

  describe('validateType', () => {
    describe('string', () => {
      it('should validate string', () => {
        expect(validateType('test', 'string').valid).toBe(true);
      });
      it('should coerce number to string', () => {
        const result = validateType(123, 'string');
        expect(result.valid).toBe(true);
        expect(result.coerced).toBe('123');
      });
      it('should fail for other types', () => {
        expect(validateType(true, 'string').valid).toBe(false);
      });
    });

    describe('integer', () => {
      it('should validate integer', () => {
        expect(validateType(123, 'integer').valid).toBe(true);
      });
      it('should coerce string integer', () => {
        const result = validateType('123', 'integer');
        expect(result.valid).toBe(true);
        expect(result.coerced).toBe(123);
      });
      it('should fail for float', () => {
        expect(validateType(12.34, 'integer').valid).toBe(false);
      });
      it('should fail for non-numeric string', () => {
        expect(validateType('abc', 'integer').valid).toBe(false);
      });
    });

    describe('number', () => {
      it('should validate number', () => {
        expect(validateType(12.34, 'number').valid).toBe(true);
      });
      it('should coerce string number', () => {
        const result = validateType('12.34', 'number');
        expect(result.valid).toBe(true);
        expect(result.coerced).toBe(12.34);
      });
      it('should fail for invalid string', () => {
        expect(validateType('abc', 'number').valid).toBe(false);
      });
    });

    describe('boolean', () => {
      it('should validate boolean', () => {
        expect(validateType(true, 'boolean').valid).toBe(true);
        expect(validateType(false, 'boolean').valid).toBe(true);
      });
      it('should coerce string "true"/"false"', () => {
        expect(validateType('true', 'boolean')).toEqual({ valid: true, coerced: true });
        expect(validateType('false', 'boolean')).toEqual({ valid: true, coerced: false });
      });
      it('should fail for other strings', () => {
        expect(validateType('yes', 'boolean').valid).toBe(false);
      });
    });

    describe('array<string>', () => {
      it('should validate array of strings', () => {
        expect(validateType(['a', 'b'], 'array<string>').valid).toBe(true);
      });
      it('should coerce array items to strings', () => {
        const result = validateType(['a', 1], 'array<string>');
        expect(result.valid).toBe(true);
        expect(result.coerced).toEqual(['a', '1']);
      });
      it('should fail for non-array', () => {
        expect(validateType('not-array', 'array<string>').valid).toBe(false);
      });
    });

    describe('array<integer>', () => {
      it('should validate array of integers', () => {
        expect(validateType([1, 2], 'array<integer>').valid).toBe(true);
      });
      it('should coerce string integers in array', () => {
        const result = validateType([1, '2'], 'array<integer>');
        expect(result.valid).toBe(true);
        expect(result.coerced).toEqual([1, 2]);
      });
      it('should fail if any item is not integer', () => {
        expect(validateType([1, 'a'], 'array<integer>').valid).toBe(false);
      });
    });

    describe('object', () => {
      it('should validate object', () => {
        expect(validateType({ a: 1 }, 'object').valid).toBe(true);
      });
      it('should fail for array', () => {
        expect(validateType([], 'object').valid).toBe(false);
      });
      it('should fail for null', () => {
        expect(validateType(null, 'object').valid).toBe(false);
      });
    });

    it('should return valid for unknown type', () => {
      expect(validateType('any', 'unknown-type').valid).toBe(true);
    });
  });

  describe('checkRequired', () => {
    it('should return missing required params', () => {
      const schema = {
        req1: { required: true },
        req2: { required: true },
        opt: { required: false }
      };
      const context = { req1: 'present' };
      const missing = checkRequired(context, schema);
      expect(missing).toEqual(['req2']);
    });
  });

  describe('sanitizeForShell', () => {
    it('should pass through simple alphanumeric strings', () => {
      expect(sanitizeForShell('simple')).toBe('simple');
      expect(sanitizeForShell('file.txt')).toBe('file.txt');
      expect(sanitizeForShell('path/to/file')).toBe('path/to/file');
      expect(sanitizeForShell('dash-underscore_')).toBe('dash-underscore_');
    });

    it('should quote strings with spaces', () => {
      expect(sanitizeForShell('hello world')).toBe("'hello world'");
    });

    it('should escape single quotes', () => {
      expect(sanitizeForShell("It's me")).toBe("'It'\\''s me'");
    });

    it('should handle shell special characters', () => {
      expect(sanitizeForShell('; rm -rf /')).toBe("'; rm -rf /'");
      expect(sanitizeForShell('$VARIABLE')).toBe("'$VARIABLE'");
      expect(sanitizeForShell('file > output')).toBe("'file > output'");
    });

    it('should convert non-strings to string', () => {
      expect(sanitizeForShell(123)).toBe('123');
    });
  });

  describe('sanitizeValue', () => {
    it('should sanitize array items recursively', () => {
      const input = ['safe', 'un safe'];
      const output = sanitizeValue(input);
      expect(output).toEqual(['safe', "'un safe'"]);
    });

    it('should pass numbers through', () => {
      expect(sanitizeValue(123)).toBe(123);
    });
  });

  describe('checkPlaceholders', () => {
    it('should detect placeholders', () => {
      const result = checkPlaceholders('echo {message}');
      expect(result.hasPlaceholders).toBe(true);
      expect(result.placeholders).toEqual(['message']);
    });

    it('should return false for no placeholders', () => {
      const result = checkPlaceholders('echo hello');
      expect(result.hasPlaceholders).toBe(false);
      expect(result.placeholders).toEqual([]);
    });

    it('should detect multiple placeholders', () => {
      const result = checkPlaceholders('mv {source} {dest}');
      expect(result.hasPlaceholders).toBe(true);
      expect(result.placeholders).toEqual(['source', 'dest']);
    });
  });

  describe('validateCommand', () => {
    it('should pass for command without placeholders', () => {
      expect(() => validateCommand('echo hello')).not.toThrow();
    });

    it('should throw ValidationError for unsubstituted placeholders', () => {
      try {
        validateCommand('echo {message}');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR);
        expect(err.message).toContain('unsubstituted placeholders');
        expect(err.errors[0].param).toBe('message');
      }
    });
  });
});
