process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn().mockResolvedValue({ release: jest.fn() })
}));

jest.mock('../models/user.model');
jest.mock('../models/permission.model');
jest.mock('../models/tenant.model');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Permission = require('../models/permission.model');
const Tenant = require('../models/tenant.model');

function bearerToken(payload) {
  return 'Bearer ' + jwt.sign(payload, 'test-jwt-secret', { expiresIn: '1h' });
}

const superAdminToken = bearerToken({ userId: 1, email: 'super@ctrl.iq', tenantId: 1, roleId: 1 });
const regularToken    = bearerToken({ userId: 2, email: 'user@acme.com',  tenantId: 2, roleId: 3 });

const VALID_RESOURCES = [
  'RCM', 'PBC', 'Attributes', 'Client', 'Periodic Testing',
  'AI Prompts', 'User Management', 'Role Management', 'Access Control'
];

afterEach(() => jest.clearAllMocks());

// ─── GET /api/data/permissions/resources ──────────────────────────────────────

describe('GET /api/data/permissions/resources', () => {
  test('returns all 9 valid resources', async () => {
    const res = await request(app)
      .get('/api/data/permissions/resources')
      .set('Authorization', regularToken);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(9);
    const returned = res.body.map(r => r.resource);
    expect(returned).toEqual(expect.arrayContaining(VALID_RESOURCES));
  });
});

// ─── GET /api/data/permissions/my-permissions ─────────────────────────────────

describe('GET /api/data/permissions/my-permissions', () => {
  test('super admin receives all resources fully enabled without DB call', async () => {
    const res = await request(app)
      .get('/api/data/permissions/my-permissions')
      .set('Authorization', superAdminToken);

    expect(res.status).toBe(200);
    expect(Permission.getByRoleId).not.toHaveBeenCalled();

    const perms = res.body;
    expect(perms).toHaveLength(VALID_RESOURCES.length);
    perms.forEach(p => {
      expect(p.can_view).toBe(1);
      expect(p.can_create).toBe(1);
      expect(p.can_update).toBe(1);
      expect(p.can_delete).toBe(1);
    });
  });

  test('regular user gets permissions from DB', async () => {
    const mockPerms = [
      { resource: 'RCM', can_view: 1, can_create: 0, can_update: 0, can_delete: 0 }
    ];
    Permission.getByRoleId.mockResolvedValue(mockPerms);

    const res = await request(app)
      .get('/api/data/permissions/my-permissions')
      .set('Authorization', regularToken);

    expect(res.status).toBe(200);
    expect(Permission.getByRoleId).toHaveBeenCalledWith(3, 2);
    expect(res.body).toEqual(mockPerms);
  });

  test('returns 403 when no token provided', async () => {
    const res = await request(app).get('/api/data/permissions/my-permissions');
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/data/permissions/tenants ────────────────────────────────────────

describe('GET /api/data/permissions/tenants', () => {
  test('returns 403 for non-super-admin', async () => {
    const res = await request(app)
      .get('/api/data/permissions/tenants')
      .set('Authorization', regularToken);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Super Admin/);
  });

  test('returns tenant list for super admin', async () => {
    const mockTenants = [{ tenant_id: 1, tenant_name: 'ControlIQ' }, { tenant_id: 2, tenant_name: 'Acme' }];
    Tenant.getAll.mockResolvedValue(mockTenants);

    const res = await request(app)
      .get('/api/data/permissions/tenants')
      .set('Authorization', superAdminToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTenants);
  });
});

// ─── PUT /api/data/permissions/role/:roleId ───────────────────────────────────

describe('PUT /api/data/permissions/role/:roleId', () => {
  test('returns 400 when permissions array is missing', async () => {
    const res = await request(app)
      .put('/api/data/permissions/role/3')
      .set('Authorization', regularToken)
      .send({});

    expect(res.status).toBe(400);
    // Joi validation fires first — check its error format
    expect(res.body.message).toBe('Validation error.');
    expect(res.body.details.some(d => /permissions/i.test(d))).toBe(true);
  });

  test('returns 400 when permissions array is not an array', async () => {
    const res = await request(app)
      .put('/api/data/permissions/role/3')
      .set('Authorization', regularToken)
      .send({ permissions: 'not-an-array' });

    expect(res.status).toBe(400);
  });

  test('returns 400 for an invalid resource name', async () => {
    const res = await request(app)
      .put('/api/data/permissions/role/3')
      .set('Authorization', regularToken)
      .send({ permissions: [{ resource: 'INVALID_RESOURCE', can_view: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid resource/);
  });

  test('returns 200 and updates permissions for valid input', async () => {
    Permission.bulkUpsert.mockResolvedValue([10, 11]);

    const res = await request(app)
      .put('/api/data/permissions/role/3')
      .set('Authorization', regularToken)
      .send({
        permissions: [
          { resource: 'RCM', can_view: 1, can_create: 0, can_update: 0, can_delete: 0 }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Permissions updated successfully.');
    expect(Permission.bulkUpsert).toHaveBeenCalled();
  });
});
