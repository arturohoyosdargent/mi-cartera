'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');

const script = path.join(__dirname, 'deploy-hosting-wif.cjs');
const provider = 'iam.googleapis.com/projects/718623808251/locations/global/workloadIdentityPools/mi-cartera-gh-v2/providers/github-hosting';
const endpoint = 'https://pipelines.actions.githubusercontent.com/oidc?api-version=2.0';
const env = {
  ACTIONS_ID_TOKEN_REQUEST_URL: endpoint,
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fake-request-credential',
  FIREBASE_TOKEN: 'fake-legacy-credential'
};
const jwt = 'fixture.header.signature';

function setup(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-wif-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  assert.ok(fs.existsSync(script), 'the protected publisher needs a repository-owned WIF entry point');
  return { temp, deployWithFederation: require(script).deployWithFederation };
}

test('requests the correct audience and exposes ephemeral ADC only to Hosting', async t => {
  const { temp, deployWithFederation } = setup(t);
  let called = false;
  await deployWithFederation({
    env: { ...env, RUNNER_TEMP: temp },
    request: async (url, options) => {
      assert.equal(url.origin + url.pathname, endpoint.split('?')[0]);
      assert.equal(url.searchParams.get('api-version'), '2.0');
      assert.equal(url.searchParams.get('audience'), `https://${provider}`);
      assert.equal(options.headers.Authorization, `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`);
      assert.equal(options.redirect, 'error');
      return { ok: true, json: async () => ({ value: jwt }) };
    },
    deploy: (command, args, options) => {
      called = true;
      assert.equal(command, 'firebase');
      assert.deepEqual(args, ['deploy', '--only', 'hosting:v2', '--project', 'mi-cartera-d0d8c', '--config', 'firebase.v2.json', '--non-interactive']);
      assert.equal(options.env.FIREBASE_TOKEN, undefined);
      assert.equal(options.env.ACTIONS_ID_TOKEN_REQUEST_URL, undefined);
      assert.equal(options.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, undefined);
      const adc = options.env.GOOGLE_APPLICATION_CREDENTIALS;
      assert.ok(path.dirname(adc).startsWith(`${temp}${path.sep}`));
      const config = JSON.parse(fs.readFileSync(adc, 'utf8'));
      assert.equal(config.type, 'external_account');
      assert.equal(config.audience, `//${provider}`);
      assert.equal(config.subject_token_type, 'urn:ietf:params:oauth:token-type:jwt');
      assert.equal(config.token_url, 'https://sts.googleapis.com/v1/token');
      assert.equal(config.service_account_impersonation_url, 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/github-v2-hosting@mi-cartera-d0d8c.iam.gserviceaccount.com:generateAccessToken');
      assert.equal(fs.readFileSync(config.credential_source.file, 'utf8'), jwt);
      if (process.platform !== 'win32') {
        assert.equal(fs.statSync(config.credential_source.file).mode & 0o777, 0o600);
        assert.equal(fs.statSync(adc).mode & 0o777, 0o600);
      }
      return { status: 0 };
    }
  });
  assert.ok(called);
  assert.deepEqual(fs.readdirSync(temp), []);
});

test('fails closed before running Firebase when GitHub rejects OIDC', async t => {
  const { temp, deployWithFederation } = setup(t);
  await assert.rejects(deployWithFederation({
    env: { ...env, RUNNER_TEMP: temp },
    request: async () => ({ ok: false, status: 401 }),
    deploy: () => assert.fail('Hosting invoked without credentials')
  }), /^Error: GitHub OIDC request failed \(HTTP 401\)$/);
  assert.deepEqual(fs.readdirSync(temp), []);
});

test('rejects a non-GitHub OIDC URL before forwarding request credentials', async t => {
  const { temp, deployWithFederation } = setup(t);
  await assert.rejects(deployWithFederation({
    env: { ...env, RUNNER_TEMP: temp, ACTIONS_ID_TOKEN_REQUEST_URL: 'https://actions.githubusercontent.com.example.test/oidc' },
    request: () => assert.fail('request sent to an untrusted endpoint'),
    deploy: () => assert.fail('Hosting invoked without credentials')
  }), /Invalid GitHub OIDC endpoint/);
});

test('removes ephemeral credentials even if the Firebase CLI fails', async t => {
  const { temp, deployWithFederation } = setup(t);
  await assert.rejects(deployWithFederation({
    env: { ...env, RUNNER_TEMP: temp },
    request: async () => ({ ok: true, json: async () => ({ value: jwt }) }),
    deploy: () => ({ status: 1 })
  }), /Firebase Hosting deployment failed/);
  assert.deepEqual(fs.readdirSync(temp), []);
});
