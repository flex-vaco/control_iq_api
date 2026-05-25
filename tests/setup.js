// Suppress console.error during tests — controllers log intentional error paths
// (fileFilter rejections, DB errors, etc.) which would otherwise clutter output.
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});
