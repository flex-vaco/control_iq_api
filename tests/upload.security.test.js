'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// ─── DB / model mocks (hoisted by Jest before imports) ───────────────────────

jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn().mockResolvedValue({ release: jest.fn() })
}));

jest.mock('../models/user.model');
jest.mock('../models/rcm.model');
jest.mock('../models/pbc.model');
jest.mock('../models/test_executions.model');
jest.mock('../models/test_execution_evidence_documents.model');

// ─── External service stubs (prevent network calls) ──────────────────────────

jest.mock('axios');
jest.mock('libreoffice-convert', () => ({ convert: jest.fn() }));

// ─── Imports ──────────────────────────────────────────────────────────────────

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const app      = require('../app');
const RCM      = require('../models/rcm.model');
const PBC      = require('../models/pbc.model');
const TestExecution = require('../models/test_executions.model');
const TestExecutionEvidenceDocuments = require('../models/test_execution_evidence_documents.model');

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const PNG_MAGIC  = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
const PHP_SCRIPT = Buffer.from('<?php system($_GET["cmd"]); ?>');
const TEN_MB_PLUS = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41);

function makeToken(overrides = {}) {
  return jwt.sign(
    { userId: 1, tenantId: 1, role: 'admin', ...overrides },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// ─── POST /api/data/pbc — createEvidence ─────────────────────────────────────

describe('POST /api/data/pbc — fileFilter enforcement', () => {
  const token = makeToken();

  test('rejects a .php file (fileFilter: invalid extension) → 500', async () => {
    const res = await request(app)
      .post('/api/data/pbc')
      .set('Authorization', `Bearer ${token}`)
      .field('control_id', 'CTRL-001')
      .field('evidence_name', 'Test Evidence')
      .field('testing_status', 'pending')
      .field('client_id', '1')
      .attach('documents', PHP_SCRIPT, { filename: 'shell.php', contentType: 'application/x-php' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/File upload failed/);
  });

  test('rejects a .php file sent with image/png MIME (still fails extension check) → 500', async () => {
    const res = await request(app)
      .post('/api/data/pbc')
      .set('Authorization', `Bearer ${token}`)
      .field('control_id', 'CTRL-001')
      .field('evidence_name', 'Test Evidence')
      .field('testing_status', 'pending')
      .field('client_id', '1')
      .attach('documents', PHP_SCRIPT, { filename: 'evil.php', contentType: 'image/png' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/File upload failed/);
  });

  test('rejects a .sh file → 500', async () => {
    const res = await request(app)
      .post('/api/data/pbc')
      .set('Authorization', `Bearer ${token}`)
      .field('control_id', 'CTRL-001')
      .field('evidence_name', 'Test Evidence')
      .field('testing_status', 'pending')
      .field('client_id', '1')
      .attach('documents', Buffer.from('#!/bin/bash\nrm -rf /'), { filename: 'run.sh', contentType: 'application/x-sh' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/File upload failed/);
  });

  test('rejects a file exceeding 10 MB → 400', async () => {
    const res = await request(app)
      .post('/api/data/pbc')
      .set('Authorization', `Bearer ${token}`)
      .field('control_id', 'CTRL-001')
      .field('evidence_name', 'Test Evidence')
      .field('testing_status', 'pending')
      .field('client_id', '1')
      .attach('documents', TEN_MB_PLUS, { filename: 'huge.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/File upload error/);
  });
});

describe('POST /api/data/pbc — magic bytes enforcement', () => {
  const token = makeToken();

  test('rejects a PHP script sent as image/png with .png extension → 400', async () => {
    const res = await request(app)
      .post('/api/data/pbc')
      .set('Authorization', `Bearer ${token}`)
      .field('control_id', 'CTRL-001')
      .field('evidence_name', 'Test Evidence')
      .field('testing_status', 'pending')
      .field('client_id', '1')
      .attach('documents', PHP_SCRIPT, { filename: 'fake.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File content does not match its declared type.');
  });

  test('rejects a PHP script sent as application/pdf with .pdf extension → 400', async () => {
    const res = await request(app)
      .post('/api/data/pbc')
      .set('Authorization', `Bearer ${token}`)
      .field('control_id', 'CTRL-001')
      .field('evidence_name', 'Test Evidence')
      .field('testing_status', 'pending')
      .field('client_id', '1')
      .attach('documents', PHP_SCRIPT, { filename: 'fake.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File content does not match its declared type.');
  });
});

// ─── POST /api/data/pbc/:id/add-documents — addEvidenceDocuments ─────────────

describe('POST /api/data/pbc/:id/add-documents — fileFilter enforcement', () => {
  const token = makeToken();

  test('rejects a .exe file → 500', async () => {
    const res = await request(app)
      .post('/api/data/pbc/1/add-documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('documents', Buffer.from('MZ\x90'), { filename: 'malware.exe', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/File upload failed/);
  });

  test('rejects a .js file → 500', async () => {
    const res = await request(app)
      .post('/api/data/pbc/1/add-documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('documents', Buffer.from('require("child_process").exec("id")'), { filename: 'exploit.js', contentType: 'application/javascript' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/File upload failed/);
  });
});

describe('POST /api/data/pbc/:id/add-documents — magic bytes enforcement', () => {
  const token = makeToken();

  beforeEach(() => {
    PBC.findById.mockResolvedValue({ id: 1, client_id: 1, tenant_id: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('rejects a PHP script sent as image/jpeg with .jpg extension → 400', async () => {
    const res = await request(app)
      .post('/api/data/pbc/1/add-documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('documents', PHP_SCRIPT, { filename: 'fake.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File content does not match its declared type.');
  });

  test('rejects a PHP script sent as application/pdf with .pdf extension → 400', async () => {
    const res = await request(app)
      .post('/api/data/pbc/1/add-documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('documents', PHP_SCRIPT, { filename: 'fake.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File content does not match its declared type.');
  });
});

// ─── POST /api/data/save-annotated-image — saveAnnotatedImage ────────────────

describe('POST /api/data/save-annotated-image — fileFilter enforcement', () => {
  const token = makeToken();

  test('rejects a .php file with invalid MIME type → 400', async () => {
    const res = await request(app)
      .post('/api/data/save-annotated-image')
      .set('Authorization', `Bearer ${token}`)
      .field('test_execution_id', '1')
      .field('evidence_document_id', '1')
      .attach('image', PHP_SCRIPT, { filename: 'shell.php', contentType: 'application/x-php' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/File upload error/);
  });

  test('rejects a .bat file → 400', async () => {
    const res = await request(app)
      .post('/api/data/save-annotated-image')
      .set('Authorization', `Bearer ${token}`)
      .field('test_execution_id', '1')
      .field('evidence_document_id', '1')
      .attach('image', Buffer.from('@echo off\ndel /f /q C:\\'), { filename: 'attack.bat', contentType: 'application/x-bat' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/File upload error/);
  });
});

describe('POST /api/data/save-annotated-image — magic bytes enforcement', () => {
  const token = makeToken();

  test('rejects PHP script content sent as image/png with .png extension → 400', async () => {
    const res = await request(app)
      .post('/api/data/save-annotated-image')
      .set('Authorization', `Bearer ${token}`)
      .field('test_execution_id', '1')
      .field('evidence_document_id', '1')
      .attach('image', PHP_SCRIPT, { filename: 'fake.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File content does not match its declared type.');
  });

  test('rejects PHP script content sent as image/jpeg with .jpeg extension → 400', async () => {
    const res = await request(app)
      .post('/api/data/save-annotated-image')
      .set('Authorization', `Bearer ${token}`)
      .field('test_execution_id', '1')
      .field('evidence_document_id', '1')
      .attach('image', PHP_SCRIPT, { filename: 'fake.jpeg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File content does not match its declared type.');
  });

  test('rejects PHP script content sent as application/pdf with .pdf extension → 400', async () => {
    const res = await request(app)
      .post('/api/data/save-annotated-image')
      .set('Authorization', `Bearer ${token}`)
      .field('test_execution_id', '1')
      .field('evidence_document_id', '1')
      .attach('image', PHP_SCRIPT, { filename: 'fake.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File content does not match its declared type.');
  });
});

// ─── Unauthenticated upload attempts ─────────────────────────────────────────

describe('Upload endpoints require authentication', () => {
  test('POST /api/data/pbc without token → 403', async () => {
    const res = await request(app)
      .post('/api/data/pbc')
      .attach('documents', PNG_MAGIC, { filename: 'valid.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });

  test('POST /api/data/save-annotated-image without token → 403', async () => {
    const res = await request(app)
      .post('/api/data/save-annotated-image')
      .attach('image', PNG_MAGIC, { filename: 'valid.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });
});
