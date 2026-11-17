'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROVIDER = 'iam.googleapis.com/projects/718623808251/locations/global/workloadIdentityPools/mi-cartera-gh-v2/providers/github-hosting';
const PROJECT = 'mi-cartera-d0d8c';
const SERVICE_ACCOUNT = `github-v2-hosting@${PROJECT}.iam.gserviceaccount.com`;

async function deployWithFederation({ env = process.env, request = fetch, deploy = spawnSync } = {}) {
  const {
    ACTIONS_ID_TOKEN_REQUEST_URL: oidcEndpoint,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: oidcCredential,
    FIREBASE_TOKEN: legacyToken,
    ...deployEnv
  } = env;
  if (!oidcEndpoint || !oidcCredential || !env.RUNNER_TEMP) {
    throw new Error('GitHub OIDC or the runner temporary directory is unavailable');
  }

  const url = URL.parse(oidcEndpoint);
  if (!url || url.protocol !== 'https:' || url.port || url.username || url.password ||
      !url.hostname.endsWith('.actions.githubusercontent.com')) {
    throw new Error('Invalid GitHub OIDC endpoint');
  }
  url.searchParams.set('audience', `https://${PROVIDER}`);
  const response = await request(url, {
    headers: { Authorization: `Bearer ${oidcCredential}` },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000)
  }).catch(() => { throw new Error('GitHub OIDC endpoint was unreachable'); });
  if (!response.ok) throw new Error(`GitHub OIDC request failed (HTTP ${response.status})`);
  const token = await response.json().then(body => body?.value, () => null);
  if (typeof token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    throw new Error('GitHub OIDC response did not contain a JWT');
  }

  const temporaryDirectory = fs.mkdtempSync(path.join(env.RUNNER_TEMP, 'hosting-wif-'));
  try {
    const subjectFile = path.join(temporaryDirectory, 'oidc.jwt');
    const adcFile = path.join(temporaryDirectory, 'adc.json');
    const privateFile = { flag: 'wx', mode: 0o600 };
    fs.writeFileSync(subjectFile, token, privateFile);
    fs.writeFileSync(adcFile, JSON.stringify({
      type: 'external_account',
      audience: `//${PROVIDER}`,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SERVICE_ACCOUNT}:generateAccessToken`,
      credential_source: { file: subjectFile }
    }), privateFile);

    const result = deploy('firebase', [
      'deploy', '--only', 'hosting:v2', '--project', PROJECT,
      '--config', 'firebase.v2.json', '--non-interactive'
    ], {
      env: { ...deployEnv, GOOGLE_APPLICATION_CREDENTIALS: adcFile },
      stdio: 'inherit'
    });
    if (result.status !== 0) throw new Error('Firebase Hosting deployment failed');
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

module.exports = { deployWithFederation };

if (require.main === module) {
  deployWithFederation().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
