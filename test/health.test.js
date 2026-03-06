const assert = require('node:assert/strict');
const test = require('node:test');

const { createApp } = require('../src/index');

test('GET /health returns a healthy status payload', async (t) => {
  const app = createApp();
  const server = app.listen(0);

  t.after(() => {
    server.close();
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'healthy');
  assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
