const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = __dirname;
function run(command, args, cwd, shell = false) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell });
  if (result.error || result.status !== 0) throw new Error('Setup stopped. Check the message above, correct the problem, and run setup again.');
}
try {
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 19)) throw new Error('Install Node.js 20.19 or newer before running setup. Node.js 24 is recommended.');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  for (const directory of ['server', 'client']) {
    console.log(`Installing ${directory} dependencies...`);
    run(npm, ['ci', '--no-audit', '--no-fund'], path.join(root, directory), process.platform === 'win32');
  }
  const serverEnv = path.join(root, 'server/.env');
  if (!fs.existsSync(serverEnv)) {
    fs.writeFileSync(serverEnv, `MONGO_URI=mongodb://127.0.0.1:27017/talentmatch_qa\nJWT_SECRET=${randomBytes(48).toString('hex')}\nPORT=5001\n`, { flag: 'wx' });
  }
  const serverConfig = require('./server/node_modules/dotenv').parse(fs.readFileSync(serverEnv));
  const backendPort = Number(serverConfig.PORT || 5000);
  if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) throw new Error('Set a valid PORT in server/.env.');
  const clientEnv = path.join(root, 'client/.env.local');
  if (!fs.existsSync(clientEnv)) fs.writeFileSync(clientEnv, `REACT_APP_API_URL=http://localhost:${backendPort}/api\n`, { flag: 'wx' });
  fs.mkdirSync(path.join(root, 'server/uploads'), { recursive: true });
  run(process.execPath, [path.join(root, 'server/scripts/seed-demo.js')], path.join(root, 'server'));
  console.log('\nSetup complete. Run: node start-local.cjs');
  console.log('Existing settings were preserved. If you changed ports, check client/.env.local too.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
