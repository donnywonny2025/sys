#!/usr/bin/env node

const { spawnSync } = require('child_process');
const http = require('http');

const message = process.argv.slice(2).join(' ');
if (!message) {
    console.error('Usage: ./execution/ask_openclaw.js "<message>"');
    process.exit(1);
}

// Function to push to dashboard
function pushToDashboard(entry, status) {
    const data = JSON.stringify({
        type: 'console',
        entry: entry,
        style: 'out',
        status: status,
        ts: new Date().toLocaleTimeString('en-US', { hour12: false })
    });
    const options = {
        hostname: 'localhost',
        port: 3111,
        path: '/api/push',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(options, () => {});
    req.on('error', () => {}); // Ignore errors if dashboard is down
    req.write(data);
    req.end();
}

// 1. Notify Dashboard we are starting
pushToDashboard(`🗨️ Asking OpenClaw: "${message}"`, 'PROCESSING');

// 2. Execute blockingly
const result = spawnSync('openclaw', ['agent', '--agent', 'main', '--message', message], {
    encoding: 'utf-8',
    env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:/Users/jeffkerr/Library/pnpm' }
});

// 3. Clean up the output to strip the Claw branding and ANSI
let output = result.stdout || '';
output = output.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, ''); // Strip ANSI
const parts = output.split('◇');
let cleanResponse = parts.length > 1 ? parts[parts.length - 1].trim() : output.trim();
if (!cleanResponse && result.stderr) cleanResponse = result.stderr.trim();

// 4. Notify Dashboard we are done
pushToDashboard(`🤖 OpenClaw: ${cleanResponse}`, 'IDLE');

// 5. Output for Antigravity terminal
console.log(cleanResponse);
