#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('Testing Claude CLI connection...\n');

// Test 1: Check if claude command exists
const checkClaude = spawn('which', ['claude']);
checkClaude.stdout.on('data', (data) => {
    console.log(`Claude location: ${data.toString().trim()}`);
});
checkClaude.on('close', (code) => {
    if (code !== 0) {
        console.error('❌ Claude CLI not found in PATH');
        process.exit(1);
    }
    
    // Test 2: Check claude version
    console.log('\nChecking Claude version...');
    const versionCheck = spawn('claude', ['--version']);
    versionCheck.stdout.on('data', (data) => {
        console.log(`Version: ${data.toString().trim()}`);
    });
    versionCheck.stderr.on('data', (data) => {
        console.error(`Error: ${data.toString()}`);
    });
    versionCheck.on('close', () => {
        
        // Test 3: Try to spawn claude with PTY
        console.log('\nTesting PTY spawn...');
        const pty = require('node-pty');
        
        try {
            const claudePty = pty.spawn('claude', ['--dangerously-skip-permissions'], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: process.cwd(),
                env: process.env
            });
            
            console.log('✅ PTY spawn successful');
            
            let output = '';
            let timeout;
            
            claudePty.onData((data) => {
                output += data;
                console.log('Received data:', JSON.stringify(data));
                
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    console.log('\n--- Full output ---');
                    console.log(output);
                    console.log('--- End output ---\n');
                    
                    // Send a test message
                    console.log('Sending test message...');
                    claudePty.write('echo "Hello from debug"\n');
                    
                    setTimeout(() => {
                        claudePty.kill();
                        process.exit(0);
                    }, 3000);
                }, 2000);
            });
            
            claudePty.onExit(({ exitCode }) => {
                console.log(`Claude exited with code ${exitCode}`);
            });
            
        } catch (error) {
            console.error('❌ PTY spawn failed:', error.message);
            process.exit(1);
        }
    });
});