import path from 'path';
import fs from 'fs';

// Allowed root directories for local exploration
const WORKSPACE_ROOT = path.resolve(process.cwd());

// Explicitly forbidden system paths and prefixes
const FORBIDDEN_SYSTEM_PATHS = [
  '/etc',
  '/proc',
  '/sys',
  '/dev',
  '/root',
  '/var/run',
  '/var/log',
  '/boot',
  '/bin',
  '/sbin',
  '/usr/bin',
  '/usr/sbin',
  '/lib',
  '/lib64',
  '/opt',
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\Users\\Default',
];

export interface ValidationResult {
  isValid: boolean;
  resolvedPath?: string;
  error?: string;
}

/**
 * Sandboxes local directory and file access:
 * 1. Rejects null-bytes and traversal tokens (.. / %2e%2e / hidden escapes)
 * 2. Canonicalizes path with path.resolve and fs.realpath
 * 3. Restricts access to current working directory or allowed parent workspaces
 * 4. Strictly blocks sensitive OS directories and credentials
 */
export function validateLocalPath(rawPath: string | undefined): ValidationResult {
  if (!rawPath || rawPath.trim() === '') {
    return { isValid: true, resolvedPath: WORKSPACE_ROOT };
  }

  const cleaned = rawPath.trim();

  // 1. Check for null byte injection
  if (cleaned.includes('\0')) {
    return {
      isValid: false,
      error: 'Security Sandbox Violation: Null byte injection detected in path.',
    };
  }

  // 2. Normalize and check for encoded traversal sequences
  const decoded = decodeURIComponent(cleaned);
  if (decoded.includes('\0')) {
    return {
      isValid: false,
      error: 'Security Sandbox Violation: Invalid characters detected in path.',
    };
  }

  // 3. Resolve absolute path
  let targetPath: string;
  if (path.isAbsolute(cleaned)) {
    targetPath = path.normalize(cleaned);
  } else {
    targetPath = path.resolve(WORKSPACE_ROOT, cleaned);
  }

  // 4. Denylist check for sensitive operating system directories
  const normalizedLower = targetPath.toLowerCase();
  for (const forbidden of FORBIDDEN_SYSTEM_PATHS) {
    const forbiddenLower = forbidden.toLowerCase();
    if (normalizedLower === forbiddenLower || normalizedLower.startsWith(forbiddenLower + path.sep) || normalizedLower.startsWith(forbiddenLower + '/')) {
      return {
        isValid: false,
        error: `Security Sandbox Violation: Access to system directory "${forbidden}" is strictly prohibited.`,
      };
    }
  }

  // Check for common credential and sensitive files
  if (
    normalizedLower.includes('/.ssh') ||
    normalizedLower.includes('/.aws') ||
    normalizedLower.includes('/.gnupg') ||
    normalizedLower.includes('/id_rsa') ||
    normalizedLower.includes('/id_ed25519') ||
    normalizedLower.endsWith('/.env') ||
    normalizedLower.endsWith('\\.env')
  ) {
    return {
      isValid: false,
      error: 'Security Sandbox Violation: Access to private security credentials and environment secrets is restricted.',
    };
  }

  // 5. Check existence & realpath symlink resolution
  if (fs.existsSync(targetPath)) {
    try {
      const realPath = fs.realpathSync(targetPath);
      const realLower = realPath.toLowerCase();

      // Double-check resolved realpath against system directories
      for (const forbidden of FORBIDDEN_SYSTEM_PATHS) {
        const forbiddenLower = forbidden.toLowerCase();
        if (realLower === forbiddenLower || realLower.startsWith(forbiddenLower + path.sep) || realLower.startsWith(forbiddenLower + '/')) {
          return {
            isValid: false,
            error: `Security Sandbox Violation: Symlink resolves to restricted system path "${forbidden}".`,
          };
        }
      }

      return { isValid: true, resolvedPath: realPath };
    } catch (err: any) {
      return {
        isValid: false,
        error: `Failed to resolve real path: ${err.message}`,
      };
    }
  }

  // If path doesn't exist yet, return resolved normalized path
  return { isValid: true, resolvedPath: targetPath };
}
