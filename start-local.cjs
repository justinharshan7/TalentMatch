const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = __dirname;
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function portFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}
async function main() {
  for (const relative of ['server/.env', 'client/.env.local', 'client/node_modules/react-scripts/scripts/start.js', 'server/node_modules/dotenv']) {
    if (!fs.existsSync(path.join(root, relative))) throw new Error('Run node setup-local.cjs before starting the app.');
  }
  const config = require('./server/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'server/.env')));
  const backendPort = Number(config.PORT || 5000);
  if (backendPort === 3000 || !Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) throw new Error('Set a valid backend port other than 3000 in server/.env.');
  for (const port of [backendPort, 3000]) {
    if (!await portFree(port)) throw new Error(`Port ${port} is already being used. Stop that app or its existing TalentMatch server first.`);
  }
  const specs = [
    { cwd: 'server', script: 'server/server.js', env: { PORT: String(backendPort), MONGO_URI: config.MONGO_URI, JWT_SECRET: config.JWT_SECRET } },
    { cwd: 'client', script: 'client/node_modules/react-scripts/scripts/start.js', env: { PORT: '3000', BROWSER: 'none' } }
  ];
  for (const spec of specs) {
    const child = spawn(process.execPath, [path.join(root, spec.script)], { cwd: path.join(root, spec.cwd), stdio: 'inherit', env: { ...process.env, ...spec.env } });
    children.push(child);
    child.on('error', (error) => { console.error(error.message); stop(1); });
    child.on('exit', (code) => { if (!stopping) stop(code || 0); });
  }
  console.log('Starting TalentMatch at http://localhost:3000');
  console.log('Keep this terminal open. Press Ctrl+C to stop both servers.');
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
main().catch((error) => { console.error(error.message); stop(1); });
