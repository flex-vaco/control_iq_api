const fs = require('fs').promises;
const path = require('path');

const ALLOWED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp',
  'pdf', 'doc', 'docx', 'xls', 'xlsx'
]);

// Strip path separators and remove characters outside [a-zA-Z0-9._-].
// Leading dots are replaced so the file cannot be hidden or a relative path component.
exports.sanitizeFilename = (originalname) => {
  const base = path.basename(originalname);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '_');
};

// Extract the lowercased extension and return it only if it is in the allowlist.
// Returns null for any unknown or unsafe extension.
exports.sanitizeExtension = (originalname) => {
  const ext = path.extname(originalname).slice(1).toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
};

// Sanitize a user-supplied value for safe use as a filename segment (e.g. control_id).
exports.sanitizeSegment = (value) => {
  return String(value).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
};

// Magic-byte signatures keyed by MIME type.
// Each entry has either `bytes` (a prefix to match at offset 0)
// or a custom `check` name for types needing non-trivial logic.
const MAGIC = {
  'image/png':   { bytes: [0x89, 0x50, 0x4E, 0x47] },
  'image/jpeg':  { bytes: [0xFF, 0xD8, 0xFF] },
  'image/jpg':   { bytes: [0xFF, 0xD8, 0xFF] },
  'image/gif':   { bytes: [0x47, 0x49, 0x46, 0x38] },
  'image/webp':  { check: 'webp' },
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46] },
  // OLE2 compound document — covers .doc and .xls
  'application/msword':     { bytes: [0xD0, 0xCF, 0x11, 0xE0] },
  'application/vnd.ms-excel': { bytes: [0xD0, 0xCF, 0x11, 0xE0] },
  // OOXML (ZIP-based) — covers .docx and .xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { bytes: [0x50, 0x4B] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':       { bytes: [0x50, 0x4B] },
};

// Read the first 12 bytes of `filePath` and confirm they match the magic bytes
// for `declaredMime`. Returns true if valid, false otherwise.
exports.validateMagicBytes = async (filePath, declaredMime) => {
  const sig = MAGIC[declaredMime];
  if (!sig) return false; // MIME type not in our allowlist at all

  try {
    const fd = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(12);
    await fd.read(buf, 0, 12, 0);
    await fd.close();

    if (sig.check === 'webp') {
      // WEBP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
      return (
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
      );
    }

    return sig.bytes.every((byte, i) => buf[i] === byte);
  } catch {
    return false;
  }
};
