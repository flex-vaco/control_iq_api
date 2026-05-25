process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth.middleware');

// Build a minimal express-style req/res/next harness
function makeReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('verifyToken middleware', () => {
  const validToken = jwt.sign(
    { userId: 1, email: 'admin@acme.com', tenantId: 2, roleId: 2 },
    'test-jwt-secret',
    { expiresIn: '1h' }
  );

  test('returns 403 when Authorization header is absent', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for a tampered / invalid token', () => {
    const req = makeReq('Bearer invalid.token.here');
    const res = makeRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized. Invalid token.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for an expired token', () => {
    const expiredToken = jwt.sign(
      { userId: 1, email: 'admin@acme.com', tenantId: 2, roleId: 2 },
      'test-jwt-secret',
      { expiresIn: -1 }
    );
    const req = makeReq(`Bearer ${expiredToken}`);
    const res = makeRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and attaches user when token is valid', () => {
    const req = makeReq(`Bearer ${validToken}`);
    const res = makeRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ userId: 1, email: 'admin@acme.com', tenantId: 2, roleId: 2 });
  });

  test('accepts token without Bearer prefix', () => {
    const req = makeReq(validToken);
    const res = makeRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.userId).toBe(1);
  });
});
