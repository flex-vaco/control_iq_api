API
-----
cd /Users/rajender.vanamala/WORK/DEV/control_iq/control_iq_api

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run a single test file
npx jest tests/auth.test.js
npx jest tests/middleware.test.js
npx jest tests/permissions.test.js

UI
-----
cd /Users/rajender.vanamala/WORK/DEV/control_iq/control_iq_ui

# Run all tests (non-interactive / CI mode)
CI=true npm test

# Run only the files in src/tests/
CI=true npm test -- --testPathPattern="src/tests"

# Run a single test file
CI=true npm test -- --testPathPattern="src/tests/Login"
CI=true npm test -- --testPathPattern="src/tests/PrivateRoute"
CI=true npm test -- --testPathPattern="src/tests/AuthContext"

# Run with coverage
CI=true npm test -- --coverage --testPathPattern="src/tests"
