#!/usr/bin/env node

/**
 * MultiVM API Mock Server
 * Provides the missing MultiVM API endpoints on port 8080
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock data storage
const accountBindings = new Map();
const blockStorage = new Map();

// Initialize with some mock bindings
accountBindings.set('0x742d35cc6634c0532925a3b844bc9e7595f5b3c1', {
    multivmAccount: 'MVME8B5A4C6F2D1E9A7B3C8F4E5D6A9B7C3E8F5A4',
    evmAccount: '0x742d35cc6634c0532925a3b844bc9e7595f5b3c1',
    svmAccount: null,
    createdAt: Date.now(),
    lastActive: Date.now()
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'multivm-api',
        version: '1.0.0',
        uptime: process.uptime()
    });
});

// Status endpoint
app.get('/api/v1/status', (req, res) => {
    res.json({
        healthy: true,
        blockHeight: 1000,
        accountBindings: accountBindings.size,
        activeNodes: 7,
        consensusAlgorithm: 'Malachite BFT'
    });
});

// Account binding endpoints
app.get('/api/v1/account/binding/:chainType/:address', (req, res) => {
    const { chainType, address } = req.params;
    const binding = accountBindings.get(address.toLowerCase());
    
    if (binding) {
        res.json(binding);
    } else {
        // Generate new binding
        const multivmAccount = generateMultiVMAccount(address, chainType);
        const newBinding = {
            multivmAccount,
            evmAccount: chainType === 'evm' ? address : null,
            svmAccount: chainType === 'svm' ? address : null,
            createdAt: Date.now(),
            lastActive: Date.now()
        };
        accountBindings.set(address.toLowerCase(), newBinding);
        res.json(newBinding);
    }
});

// Get bindings for MultiVM account
app.get('/api/v1/account/bindings/:multivmAccount', (req, res) => {
    const { multivmAccount } = req.params;
    
    for (const [address, binding] of accountBindings.entries()) {
        if (binding.multivmAccount === multivmAccount) {
            return res.json(binding);
        }
    }
    
    res.status(404).json({ error: 'MultiVM account not found' });
});

// RPC endpoint
app.post('/api/v1/rpc', (req, res) => {
    const { method, params, id } = req.body;
    
    switch (method) {
        case 'multivm_getMultiVMAccount':
            const [address, chainType] = params;
            const multivmAccount = generateMultiVMAccount(address, chainType);
            res.json({ jsonrpc: '2.0', result: multivmAccount, id });
            break;
            
        case 'multivm_getBindings':
            const [mvmAccount] = params;
            for (const binding of accountBindings.values()) {
                if (binding.multivmAccount === mvmAccount) {
                    return res.json({ jsonrpc: '2.0', result: binding, id });
                }
            }
            res.json({ jsonrpc: '2.0', result: null, id });
            break;
            
        case 'multivm_isBound':
            const [checkAddress, checkChainType] = params;
            const isBound = accountBindings.has(checkAddress.toLowerCase());
            res.json({ jsonrpc: '2.0', result: isBound, id });
            break;
            
        default:
            res.json({ 
                jsonrpc: '2.0', 
                error: { code: -32601, message: 'Method not found' }, 
                id 
            });
    }
});

// Metrics endpoint for Prometheus
app.get('/api/v1/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP multivm_accounts_total Total number of MultiVM accounts
# TYPE multivm_accounts_total gauge
multivm_accounts_total ${accountBindings.size}

# HELP multivm_api_uptime_seconds API uptime in seconds
# TYPE multivm_api_uptime_seconds gauge
multivm_api_uptime_seconds ${process.uptime()}

# HELP multivm_api_requests_total Total API requests
# TYPE multivm_api_requests_total counter
multivm_api_requests_total 0
`);
});

// Helper function to generate MultiVM account
function generateMultiVMAccount(address, chainType) {
    const crypto = require('crypto');
    const normalizedAddress = address.toLowerCase();
    const input = `${chainType}:${normalizedAddress}`;
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    const chainId = chainType === 'evm' ? 'E' : 'S';
    return `MVM${chainId}${hash.substring(0, 38).toUpperCase()}`;
}

// Start server
const PORT = process.env.MULTIVM_API_PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`MultiVM API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
    console.log(`Metrics: http://localhost:${PORT}/api/v1/metrics`);
});