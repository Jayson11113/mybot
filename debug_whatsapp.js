const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

const browserPath = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome', 'win64-146.0.7680.153', 'chrome-win64', 'chrome.exe');
console.log('Browser path:', browserPath, 'exists=', fs.existsSync(browserPath));

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'debug-client' }),
  puppeteer: {
    executablePath: browserPath,
    headless: true,
    protocolTimeout: 0,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  },
  authTimeoutMs: 30000
});

client.on('qr', qr => {
  console.log('QR EVENT RECEIVED');
  console.log(qr);
});
client.on('loading_screen', (percent, message) => console.log('loading', percent, message));
client.on('authenticated', () => console.log('authenticated'));
client.on('ready', () => console.log('ready'));
client.on('auth_failure', err => console.error('auth_failure', err));
client.on('disconnected', reason => console.log('disconnected', reason));

client.initialize().then(() => console.log('initialize resolved')).catch(err => console.error('initialize rejected', err));

setTimeout(() => {
  console.log('Timeout reached, exiting.');
  process.exit(0);
}, 40000);
