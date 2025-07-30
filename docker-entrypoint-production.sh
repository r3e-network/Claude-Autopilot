#!/bin/bash
set -e

# Production Docker entrypoint for MultiVM
# This version implements proper consensus-driven block production

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting MultiVM Production Node${NC}"

# Environment variables with defaults
export NODE_ID=${NODE_ID:-1}
export NODE_NAME=${NODE_NAME:-"multivm-node-$NODE_ID"}
export DATA_DIR=${DATA_DIR:-/opt/multivm/data}
export CONFIG_DIR=${CONFIG_DIR:-/opt/multivm/config}
export MULTIVM_PORT=${MULTIVM_PORT:-8080}
export RETH_PORT=${RETH_PORT:-8545}
export SOLANA_PORT=${SOLANA_PORT:-8899}
export P2P_PORT=${P2P_PORT:-30303}

# Engine API configuration
export ENGINE_JWT_SECRET=${ENGINE_JWT_SECRET:-"$DATA_DIR/ethereum/jwt.hex"}
export ENGINE_API_PORT=${ENGINE_API_PORT:-8551}

# Binary paths
export MULTIVM_BINARY=${MULTIVM_BINARY:-/opt/multivm/bin/multivm}
export RETH_BINARY_PATH=${RETH_BINARY_PATH:-/opt/multivm/bin/reth}
export SOLANA_BINARY_PATH=${SOLANA_BINARY_PATH:-/opt/multivm/bin/multivm-validator}

# Production flags
export PRODUCTION_MODE=${PRODUCTION_MODE:-true}
export ENABLE_TLS=${ENABLE_TLS:-false}
export ENABLE_MONITORING=${ENABLE_MONITORING:-true}

# Create necessary directories
mkdir -p "$DATA_DIR"/{multivm,ethereum,solana,consensus}
mkdir -p "$CONFIG_DIR"
mkdir -p /var/log/multivm

# Generate JWT secret if not exists
if [ ! -f "$ENGINE_JWT_SECRET" ]; then
    echo -e "${YELLOW}Generating Engine API JWT secret...${NC}"
    openssl rand -hex 32 > "$ENGINE_JWT_SECRET"
    chmod 600 "$ENGINE_JWT_SECRET"
fi

# Function to start Reth in production mode (no --dev flag)
start_reth_production() {
    echo -e "${GREEN}Starting Reth in production mode...${NC}"
    
    # Check if genesis file exists
    if [ ! -f "$CONFIG_DIR/genesis.json" ]; then
        echo -e "${RED}Error: Genesis file not found at $CONFIG_DIR/genesis.json${NC}"
        exit 1
    fi
    
    # Initialize Reth if needed
    if [ ! -d "$DATA_DIR/ethereum/db" ]; then
        echo "Initializing Reth database..."
        $RETH_BINARY_PATH init \
            --datadir "$DATA_DIR/ethereum" \
            --chain "$CONFIG_DIR/genesis.json"
    fi
    
    # Start Reth with Engine API enabled
    $RETH_BINARY_PATH node \
        --datadir "$DATA_DIR/ethereum" \
        --chain "$CONFIG_DIR/genesis.json" \
        --authrpc.jwtsecret "$ENGINE_JWT_SECRET" \
        --authrpc.addr 127.0.0.1 \
        --authrpc.port $ENGINE_API_PORT \
        --http \
        --http.addr 0.0.0.0 \
        --http.port $RETH_PORT \
        --http.api eth,net,web3,debug,trace,txpool \
        --http.corsdomain "*" \
        --ws \
        --ws.addr 0.0.0.0 \
        --ws.port $((RETH_PORT + 1)) \
        --ws.api eth,net,web3,debug,trace \
        --port $P2P_PORT \
        --discovery.port $P2P_PORT \
        --metrics 0.0.0.0:9001 \
        --log.file.directory /var/log/multivm \
        > /var/log/multivm/reth.log 2>&1 &
    
    RETH_PID=$!
    echo "Reth started with PID: $RETH_PID"
    echo $RETH_PID > /var/run/reth.pid
}

# Function to start Solana validator
start_solana_validator() {
    echo -e "${GREEN}Starting Solana validator...${NC}"
    
    # Initialize ledger if needed
    if [ ! -d "$DATA_DIR/solana/ledger" ]; then
        echo "Initializing Solana ledger..."
        $SOLANA_BINARY_PATH \
            --ledger "$DATA_DIR/solana/ledger" \
            --identity "$CONFIG_DIR/validator-keypair.json" \
            --reset
    fi
    
    # Start validator
    $SOLANA_BINARY_PATH \
        --ledger "$DATA_DIR/solana/ledger" \
        --identity "$CONFIG_DIR/validator-keypair.json" \
        --vote-account "$CONFIG_DIR/vote-keypair.json" \
        --rpc-port $SOLANA_PORT \
        --gossip-port $((P2P_PORT + 100)) \
        --dynamic-port-range 8100-8200 \
        --log /var/log/multivm/solana.log \
        --metrics-port 9002 \
        > /var/log/multivm/solana.log 2>&1 &
    
    SOLANA_PID=$!
    echo "Solana validator started with PID: $SOLANA_PID"
    echo $SOLANA_PID > /var/run/solana.pid
}

# Function to start MultiVM with consensus
start_multivm_consensus() {
    echo -e "${GREEN}Starting MultiVM consensus layer...${NC}"
    
    # Create MultiVM config if not exists
    if [ ! -f "$CONFIG_DIR/multivm.toml" ]; then
        cat > "$CONFIG_DIR/multivm.toml" <<EOF
[node]
id = $NODE_ID
name = "$NODE_NAME"
data_dir = "$DATA_DIR/multivm"

[consensus]
algorithm = "malachite_bft"
block_time = 5000  # 5 seconds in milliseconds
min_validators = 4

[engines]
ethereum_rpc = "http://127.0.0.1:$RETH_PORT"
ethereum_engine_api = "http://127.0.0.1:$ENGINE_API_PORT"
ethereum_jwt_secret = "$ENGINE_JWT_SECRET"
solana_rpc = "http://127.0.0.1:$SOLANA_PORT"

[api]
enabled = true
port = $MULTIVM_PORT
host = "0.0.0.0"

[monitoring]
enabled = $ENABLE_MONITORING
prometheus_port = 9000

[security]
enable_tls = $ENABLE_TLS
jwt_enabled = true
jwt_secret = "$ENGINE_JWT_SECRET"
EOF
    fi
    
    # Start MultiVM
    $MULTIVM_BINARY \
        --config "$CONFIG_DIR/multivm.toml" \
        > /var/log/multivm/multivm.log 2>&1 &
    
    MULTIVM_PID=$!
    echo "MultiVM started with PID: $MULTIVM_PID"
    echo $MULTIVM_PID > /var/run/multivm.pid
}

# Health check function
health_check() {
    echo -e "${YELLOW}Performing health checks...${NC}"
    
    # Check Reth
    if curl -s -X POST http://localhost:$RETH_PORT \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Reth RPC is healthy${NC}"
    else
        echo -e "${RED}✗ Reth RPC is not responding${NC}"
    fi
    
    # Check Solana
    if curl -s http://localhost:$SOLANA_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Solana RPC is healthy${NC}"
    else
        echo -e "${RED}✗ Solana RPC is not responding${NC}"
    fi
    
    # Check MultiVM
    if curl -s http://localhost:$MULTIVM_PORT/api/v1/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ MultiVM API is healthy${NC}"
    else
        echo -e "${RED}✗ MultiVM API is not responding${NC}"
    fi
}

# Signal handlers
cleanup() {
    echo -e "${YELLOW}Shutting down services...${NC}"
    
    if [ -f /var/run/multivm.pid ]; then
        kill $(cat /var/run/multivm.pid) 2>/dev/null
    fi
    
    if [ -f /var/run/reth.pid ]; then
        kill $(cat /var/run/reth.pid) 2>/dev/null
    fi
    
    if [ -f /var/run/solana.pid ]; then
        kill $(cat /var/run/solana.pid) 2>/dev/null
    fi
    
    exit 0
}

trap cleanup SIGTERM SIGINT

# Main startup sequence
echo "NODE_ID: $NODE_ID"
echo "DATA_DIR: $DATA_DIR"
echo "CONFIG_DIR: $CONFIG_DIR"
echo "PRODUCTION_MODE: $PRODUCTION_MODE"

# Start services
start_reth_production
sleep 5

start_solana_validator
sleep 5

start_multivm_consensus
sleep 5

# Run initial health check
health_check

# Monitor processes
echo -e "${GREEN}All services started. Monitoring...${NC}"

while true; do
    # Check if processes are still running
    if [ -f /var/run/reth.pid ] && ! kill -0 $(cat /var/run/reth.pid) 2>/dev/null; then
        echo -e "${RED}Reth process died, restarting...${NC}"
        start_reth_production
    fi
    
    if [ -f /var/run/solana.pid ] && ! kill -0 $(cat /var/run/solana.pid) 2>/dev/null; then
        echo -e "${RED}Solana process died, restarting...${NC}"
        start_solana_validator
    fi
    
    if [ -f /var/run/multivm.pid ] && ! kill -0 $(cat /var/run/multivm.pid) 2>/dev/null; then
        echo -e "${RED}MultiVM process died, restarting...${NC}"
        start_multivm_consensus
    fi
    
    sleep 30
done