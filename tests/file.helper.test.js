const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { sanitizeFilename, sanitizeExtension, sanitizeSegment, validateMagicBytes } = require('../utils/file.helper');

// ─── Temp-file helpers for validateMagicBytes ─────────────────────────────────

const tmpFiles = [];

function writeTmp(bytes) {
  const p = path.join(os.tmpdir(), `ciq-test-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  fs.writeFileSync(p, Buffer.from(bytes));
  tmpFiles.push(p);
  return p;
}

afterAll(() => {
  tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
});

// ─── sanitizeFilename ─────────────────────────────────────────────────────────

describe('sanitizeFilename', () => {
  test('strips Unix-style path traversal ../../', () => {
    const result = sanitizeFilename('../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
  });

  test('strips Windows-style path traversal ..\\\\', () => {
    const result = sanitizeFilename('..\\..\\server.js');
    expect(result).not.toContain('\\');
  });

  test('extracts only the basename when a full path is given', () => {
    const result = sanitizeFilename('/var/www/html/config.php');
    expect(result).not.toContain('/');
    expect(result).toContain('config');
  });

  test('replaces leading dot — prevents hidden-file creation', () => {
    expect(sanitizeFilename('.htaccess').charAt(0)).not.toBe('.');
  });

  test('replaces spaces and shell-special characters', () => {
    const result = sanitizeFilename('my evil file (1); rm -rf /.pdf');
    expect(result).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  test('leaves safe characters unchanged', () => {
    expect(sanitizeFilename('Report-Q1_2025.pdf')).toBe('Report-Q1_2025.pdf');
  });

  test('handles a filename with multiple dots', () => {
    expect(sanitizeFilename('archive.tar.gz')).toBe('archive.tar.gz');
  });
});

// ─── sanitizeExtension ────────────────────────────────────────────────────────

describe('sanitizeExtension', () => {
  test('returns lowercase extension for a valid PNG', () => {
    expect(sanitizeExtension('Screenshot.PNG')).toBe('png');
  });

  test('returns extension for a valid PDF', () => {
    expect(sanitizeExtension('report.pdf')).toBe('pdf');
  });

  test('returns extension for all allowlisted types', () => {
    const types = ['jpg','jpeg','gif','webp','doc','docx','xls','xlsx'];
    types.forEach(ext => {
      expect(sanitizeExtension(`file.${ext}`)).toBe(ext);
    });
  });

  test('returns null for .php — not in allowlist', () => {
    expect(sanitizeExtension('shell.php')).toBeNull();
  });

  test('returns null for .sh — not in allowlist', () => {
    expect(sanitizeExtension('run.sh')).toBeNull();
  });

  test('returns null for .js — not in allowlist', () => {
    expect(sanitizeExtension('app.js')).toBeNull();
  });

  test('returns null for .exe', () => {
    expect(sanitizeExtension('malware.exe')).toBeNull();
  });

  test('returns null when there is no extension', () => {
    expect(sanitizeExtension('noextension')).toBeNull();
  });

  test('uses only the LAST extension — evil.php.png resolves to png (safe)', () => {
    expect(sanitizeExtension('evil.php.png')).toBe('png');
  });

  test('strips non-alphanumeric chars inside the extension string', () => {
    // path.extname('file.ph<p').slice(1) → 'ph<p'; after replace(/[^a-z0-9]/g,'') → 'php'
    // 'php' is not in ALLOWED_EXTENSIONS → null
    expect(sanitizeExtension('file.ph<p')).toBeNull();
  });
});

// ─── sanitizeSegment ──────────────────────────────────────────────────────────

describe('sanitizeSegment', () => {
  test('trims leading and trailing whitespace', () => {
    expect(sanitizeSegment('  CTRL-001  ')).toBe('CTRL-001');
  });

  test('replaces forward-slash path separators', () => {
    const result = sanitizeSegment('../../etc/passwd');
    expect(result).not.toContain('/');
    expect(result).not.toContain('.');
  });

  test('replaces angle brackets — XSS prevention', () => {
    const result = sanitizeSegment('<script>alert(1)</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  test('preserves alphanumeric characters, hyphens, and underscores', () => {
    expect(sanitizeSegment('CTRL_001-A')).toBe('CTRL_001-A');
  });

  test('coerces a numeric value to string safely', () => {
    expect(sanitizeSegment(42)).toBe('42');
  });

  test('handles null-like value gracefully', () => {
    expect(() => sanitizeSegment('null')).not.toThrow();
    expect(sanitizeSegment('null')).toBe('null');
  });
});

// ─── validateMagicBytes ───────────────────────────────────────────────────────

describe('validateMagicBytes', () => {

  // ── Valid files ──────────────────────────────────────────────────────────────

  test('accepts a valid PNG', async () => {
    const f = writeTmp([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    expect(await validateMagicBytes(f, 'image/png')).toBe(true);
  });

  test('accepts a valid JPEG (image/jpeg)', async () => {
    const f = writeTmp([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(await validateMagicBytes(f, 'image/jpeg')).toBe(true);
  });

  test('accepts a valid JPEG (image/jpg alias)', async () => {
    const f = writeTmp([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(await validateMagicBytes(f, 'image/jpg')).toBe(true);
  });

  test('accepts a valid GIF', async () => {
    const f = writeTmp([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
    expect(await validateMagicBytes(f, 'image/gif')).toBe(true);
  });

  test('accepts a valid WEBP', async () => {
    // RIFF at 0-3, WEBP at 8-11
    const f = writeTmp([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(await validateMagicBytes(f, 'image/webp')).toBe(true);
  });

  test('accepts a valid PDF', async () => {
    const f = writeTmp([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x20, 0x25, 0xE2, 0xE3]);
    expect(await validateMagicBytes(f, 'application/pdf')).toBe(true);
  });

  test('accepts a valid DOC (OLE2) with application/msword', async () => {
    const f = writeTmp([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0x00, 0x00, 0x00, 0x00]);
    expect(await validateMagicBytes(f, 'application/msword')).toBe(true);
  });

  test('accepts a valid XLS (OLE2) with application/vnd.ms-excel', async () => {
    const f = writeTmp([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0x00, 0x00, 0x00, 0x00]);
    expect(await validateMagicBytes(f, 'application/vnd.ms-excel')).toBe(true);
  });

  test('accepts a valid DOCX (ZIP/PK) with OOXML MIME', async () => {
    const f = writeTmp([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x00, 0x00]);
    expect(await validateMagicBytes(f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
  });

  test('accepts a valid XLSX (ZIP/PK) with OOXML MIME', async () => {
    const f = writeTmp([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x00, 0x00]);
    expect(await validateMagicBytes(f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });

  // ── Rejection: content mismatch ───────────────────────────────────────────────

  test('rejects PHP script content when declared as image/png', async () => {
    const f = writeTmp(Buffer.from('<?php system($_GET["cmd"]); ?>'));
    expect(await validateMagicBytes(f, 'image/png')).toBe(false);
  });

  test('rejects PHP script content when declared as application/pdf', async () => {
    const f = writeTmp(Buffer.from('<?php echo "hello"; ?>'));
    expect(await validateMagicBytes(f, 'application/pdf')).toBe(false);
  });

  test('rejects a valid PNG when declared as application/pdf (wrong MIME)', async () => {
    const f = writeTmp([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    expect(await validateMagicBytes(f, 'application/pdf')).toBe(false);
  });

  test('rejects a valid PDF when declared as image/png (wrong MIME)', async () => {
    const f = writeTmp([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x20, 0x25, 0xE2, 0xE3]);
    expect(await validateMagicBytes(f, 'image/png')).toBe(false);
  });

  test('rejects a WEBP with wrong WEBP marker at offset 8', async () => {
    // RIFF header correct but bytes 8-11 are not WEBP
    const f = writeTmp([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20]);
    expect(await validateMagicBytes(f, 'image/webp')).toBe(false);
  });

  // ── Rejection: disallowed / unknown MIME ─────────────────────────────────────

  test('rejects an unlisted MIME type (application/x-php)', async () => {
    const f = writeTmp([0x89, 0x50, 0x4E, 0x47]);
    expect(await validateMagicBytes(f, 'application/x-php')).toBe(false);
  });

  test('rejects an unlisted MIME type (application/octet-stream)', async () => {
    const f = writeTmp([0x00, 0x01, 0x02, 0x03]);
    expect(await validateMagicBytes(f, 'application/octet-stream')).toBe(false);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────────

  test('returns false for a non-existent file path', async () => {
    expect(await validateMagicBytes('/tmp/does-not-exist-ciq-xyz.bin', 'image/png')).toBe(false);
  });

  test('returns false for an empty file', async () => {
    const f = writeTmp([]);
    expect(await validateMagicBytes(f, 'image/png')).toBe(false);
  });
});
