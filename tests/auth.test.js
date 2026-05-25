process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Mock DB before any module that transitively requires it
jest.mock('../config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn().mockResolvedValue({ release: jest.fn() })
}));

// Mock the User model — auth controller only touches this
jest.mock('../models/user.model');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/user.model');

const VALID_HASH = bcrypt.hashSync('Admin@123', 10);

const activeUser = {
  user_id: 1,
  email: 'admin@acme.com',
  password: VALID_HASH,
  is_active: 1,
  tenant_id: 2,
  role_id: 2
};

describe('POST /api/auth/login', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'Admin@123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email and password are required.');
  });

  test('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@acme.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email and password are required.');
  });

  test('returns 401 when user does not exist', async () => {
    User.findByEmail.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@acme.com', password: 'any' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials.');
  });

  test('returns 403 when user account is inactive', async () => {
    User.findByEmail.mockResolvedValue({ ...activeUser, is_active: 0 });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@acme.com', password: 'Admin@123' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('User account is inactive.');
  });

  test('returns 401 when password is wrong', async () => {
    User.findByEmail.mockResolvedValue(activeUser);
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@acme.com', password: 'WrongPass!' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials.');
  });

  test('returns 200 with Bearer token on valid credentials', async () => {
    User.findByEmail.mockResolvedValue(activeUser);
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@acme.com', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toMatch(/^Bearer /);
    expect(res.body.user).toMatchObject({ email: 'admin@acme.com', tenantId: 2 });
  });

  test('returns 500 when User.findByEmail throws', async () => {
    User.findByEmail.mockRejectedValue(new Error('DB connection lost'));
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@acme.com', password: 'Admin@123' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error during login.');
  });
});
