#!/bin/bash

# Fix transaction inclusion in MultiVM testnet
# This addresses the critical consensus architecture issue

echo "Fixing transaction inclusion in MultiVM testnet..."

# Option 1: Restart Reth without block-time to enable auto-mining
echo "Option 1: Restarting Reth with auto-mining on transaction submission..."

# Stop the current setup
docker-compose -f /path/to/docker-compose.yml stop

# Modify the Reth startup parameters
# Remove --dev.block-time parameter to enable auto-mining
sed -i 's/--dev.block-time 5sec//' /path/to/docker-entrypoint.sh

# Start the setup again
docker-compose -f /path/to/docker-compose.yml up -d

echo "Reth restarted with auto-mining enabled"

# Option 2: Use the production configuration
echo "Option 2: Switch to production configuration with Engine API..."
echo "Run: ./deploy-production.sh"

# Option 3: Manual transaction trigger (temporary workaround)
echo "Option 3: Manually trigger block production with transactions..."

# Create a transaction trigger script
cat > trigger-tx-inclusion.py << 'EOF'
#!/usr/bin/env python3
import json
import requests
import time

def trigger_block():
    # Get pending transactions
    payload = {
        "jsonrpc": "2.0",
        "method": "txpool_content",
        "params": [],
        "id": 1
    }
    
    response = requests.post("http://localhost:8545", json=payload)
    result = response.json()
    
    if 'result' in result:
        pending = result['result'].get('pending', {})
        if pending:
            print(f"Found {len(pending)} accounts with pending transactions")
            # In dev mode without block-time, sending a new transaction triggers mining
            # Send a dummy transaction to trigger block production
            dummy_tx = {
                "jsonrpc": "2.0",
                "method": "eth_sendTransaction",
                "params": [{
                    "from": "0x0000000000000000000000000000000000000001",
                    "to": "0x0000000000000000000000000000000000000002",
                    "value": "0x0",
                    "gas": "0x5208"
                }],
                "id": 2
            }
            requests.post("http://localhost:8545", json=dummy_tx)
            print("Triggered block production")

if __name__ == "__main__":
    while True:
        trigger_block()
        time.sleep(5)
EOF

chmod +x trigger-tx-inclusion.py

echo "Transaction inclusion fix options prepared."
echo ""
echo "RECOMMENDED: Use the production configuration (Option 2) which properly implements"
echo "consensus-driven block production via Engine API instead of Reth dev mode."