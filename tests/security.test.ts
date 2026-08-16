import { describe, it, expect } from 'vitest';
import { validateLocalPath } from '../server/security';
import path from 'path';

describe('Security & Sandbox Validation (validateLocalPath)', () => {
  describe('Path Traversal & Injection Prevention', () => {
    it('should reject path traversal attempts to root / system directories', () => {
      const traversalPaths = [
        '../../../../etc/passwd',
        '../../../../etc',
        '../../../var/log',
        '../../../../usr/bin',
        '../../../../proc/cpuinfo',
        '../../../../sys',
        '../../../../root',
        '../../../../boot',
      ];

      for (const p of traversalPaths) {
        const result = validateLocalPath(p);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should reject null-byte injection attempts', () => {
      const nullBytePaths = [
        'src/components\0/etc/passwd',
        './valid-dir\0.png',
        '\0/etc/shadow',
      ];

      for (const p of nullBytePaths) {
        const result = validateLocalPath(p);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Null byte');
      }
    });

    it('should reject explicitly denied system paths', () => {
      const deniedPaths = [
        '/etc',
        '/etc/nginx',
        '/var',
        '/var/run',
        '/root',
        '/proc',
        '/sys',
        '/boot',
        '/dev',
        '/bin',
        '/sbin',
      ];

      for (const p of deniedPaths) {
        const result = validateLocalPath(p);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('prohibited');
      }
    });

    it('should reject sensitive credential directory targets in home directory', () => {
      const sensitiveTargets = [
        '~/.ssh',
        '~/.aws',
        '~/.kube',
        '~/.gnupg',
        '~/.docker',
      ];

      for (const p of sensitiveTargets) {
        const result = validateLocalPath(p);
        expect(result.isValid).toBe(false);
      }
    });
  });

  describe('Input Sanitization & Normalization', () => {
    it('should default empty or whitespace-only paths to the current workspace root', () => {
      expect(validateLocalPath('').isValid).toBe(true);
      expect(validateLocalPath('').resolvedPath).toBe(process.cwd());
      expect(validateLocalPath('   ').isValid).toBe(true);
      expect(validateLocalPath('   ').resolvedPath).toBe(process.cwd());
      expect(validateLocalPath(null as any).isValid).toBe(true);
      expect(validateLocalPath(undefined as any).isValid).toBe(true);
    });

    it('should allow valid relative workspace paths and canonicalize them', () => {
      const result = validateLocalPath('.');
      expect(result.isValid).toBe(true);
      expect(result.resolvedPath).toBe(process.cwd());
    });

    it('should resolve subdirectories within the current workspace', () => {
      const result = validateLocalPath('src');
      expect(result.isValid).toBe(true);
      expect(result.resolvedPath).toBe(path.resolve(process.cwd(), 'src'));
    });

    it('should handle paths with leading/trailing whitespace correctly', () => {
      const result = validateLocalPath('  src  ');
      expect(result.isValid).toBe(true);
      expect(result.resolvedPath).toBe(path.resolve(process.cwd(), 'src'));
    });
  });
});
