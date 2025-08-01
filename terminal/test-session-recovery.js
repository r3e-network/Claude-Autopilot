#!/usr/bin/env node

const { ClaudeSession } = require('./dist/core/session');
const { SessionRecoveryManager } = require('./dist/core/sessionRecovery');
const { Config } = require('./dist/core/config');
const { Logger } = require('./dist/utils/logger');

async function testSessionRecovery() {
    console.log('Testing session recovery and keep-alive mechanisms...\n');
    
    const config = new Config();
    const logger = new Logger();
    
    // Test 1: Basic session lifecycle
    console.log('Test 1: Basic session lifecycle');
    const session = new ClaudeSession(config, logger);
    
    try {
        await session.start(true);
        console.log('✓ Session started successfully');
        
        const sessionInfo = session.getSessionInfo();
        console.log(`✓ Session info: Active=${sessionInfo.isActive}, Processing=${sessionInfo.isProcessing}`);
        
        await session.stop();
        console.log('✓ Session stopped successfully\n');
    } catch (error) {
        console.error('✗ Basic session test failed:', error.message);
    }
    
    // Test 2: Recovery manager
    console.log('Test 2: Recovery manager initialization');
    const recoveryManager = new SessionRecoveryManager(config, logger, {
        maxRetries: 3,
        retryDelay: 1000,
        preserveContext: true,
        autoRecover: true
    });
    
    try {
        await recoveryManager.initializeSession(true);
        console.log('✓ Recovery manager initialized with session');
        
        const recoveryState = recoveryManager.getRecoveryState();
        console.log(`✓ Recovery state: Recovering=${recoveryState.isRecovering}, Retries=${recoveryState.retryCount}`);
        
        await recoveryManager.stop();
        console.log('✓ Recovery manager stopped successfully\n');
    } catch (error) {
        console.error('✗ Recovery manager test failed:', error.message);
    }
    
    // Test 3: Session info tracking
    console.log('Test 3: Session activity tracking');
    const trackingSession = new ClaudeSession(config, logger);
    
    try {
        await trackingSession.start(true);
        
        // Check initial state
        let info = trackingSession.getSessionInfo();
        console.log(`✓ Initial state: Active=${info.isActive}, Messages=${info.activeMessages}`);
        
        // Simulate message processing
        console.log('✓ Simulating message processing...');
        const messagePromise = trackingSession.sendMessage('test message').catch(err => {
            console.log('✓ Expected error for test message:', err.message);
        });
        
        // Check state during processing
        info = trackingSession.getSessionInfo();
        console.log(`✓ During processing: Active=${info.isActive}, Messages=${info.activeMessages}`);
        
        await messagePromise;
        await trackingSession.stop();
        console.log('✓ Activity tracking test completed\n');
    } catch (error) {
        console.error('✗ Activity tracking test failed:', error.message);
    }
    
    console.log('All tests completed!');
    process.exit(0);
}

// Run tests
testSessionRecovery().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});