const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('register and login flow works', async () => {
  const email = `testuser-${Date.now()}@example.com`;
  const password = 'secret123';

  const registerResponse = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email, password })
  });

  assert.equal(registerResponse.status, 201);

  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  assert.equal(loginResponse.status, 200);
  const body = await loginResponse.json();
  assert.ok(body.token);
  assert.equal(body.user.email, email);
});
