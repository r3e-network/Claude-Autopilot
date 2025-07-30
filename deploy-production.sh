#!/bin/bash

# MultiVM Production Deployment Script
# This script deploys the MultiVM blockchain in production mode

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}MultiVM Production Deployment${NC}"
echo "=============================="

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Error: Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check for SSL certificates
    if [ ! -f configs/production/ssl/cert.pem ] || [ ! -f configs/production/ssl/key.pem ]; then
        echo -e "${YELLOW}SSL certificates not found. Generating self-signed certificates...${NC}"
        mkdir -p configs/production/ssl
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout configs/production/ssl/key.pem \
            -out configs/production/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=MultiVM/CN=multivm.example.com"
    fi
    
    echo -e "${GREEN}✓ Prerequisites checked${NC}"
}

# Create configuration files
create_configs() {
    echo -e "${YELLOW}Creating configuration files...${NC}"
    
    # Create directories
    mkdir -p configs/production/{node1,node2,node3}
    mkdir -p configs/production/grafana/{provisioning/datasources,provisioning/dashboards,dashboards}
    
    # Create genesis file for each node
    for i in 1 2 3; do
        cat > configs/production/node$i/genesis.json <<EOF
{
    "config": {
        "chainId": 12345,
        "homesteadBlock": 0,
        "eip150Block": 0,
        "eip155Block": 0,
        "eip158Block": 0,
        "byzantiumBlock": 0,
        "constantinopleBlock": 0,
        "petersburgBlock": 0,
        "istanbulBlock": 0,
        "berlinBlock": 0,
        "londonBlock": 0,
        "parisBlock": 0,
        "shanghaiBlock": 0,
        "cancunBlock": 0
    },
    "alloc": {
        "0x0000000000000000000000000000000000000001": {
            "balance": "1000000000000000000000000"
        }
    },
    "difficulty": "0x1",
    "gasLimit": "0x8000000",
    "nonce": "0x0000000000000000",
    "timestamp": "0x0"
}
EOF
    done
    
    # Create Grafana datasource configuration
    cat > configs/production/grafana/provisioning/datasources/prometheus.yml <<EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
EOF

    # Create Grafana dashboard provisioning
    cat > configs/production/grafana/provisioning/dashboards/dashboard.yml <<EOF
apiVersion: 1

providers:
  - name: 'MultiVM'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

    # Copy dashboard
    cp configs/production/grafana-dashboard.json configs/production/grafana/dashboards/
    
    # Create alertmanager configuration
    cat > configs/production/alertmanager.yml <<EOF
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://your-webhook-url/alerts'
        send_resolved: true
EOF

    echo -e "${GREEN}✓ Configuration files created${NC}"
}

# Build Docker images
build_images() {
    echo -e "${YELLOW}Building Docker images...${NC}"
    
    # Ensure production entrypoint is executable
    chmod +x docker-entrypoint-production.sh
    
    # Build MultiVM image if needed
    if [ ! -z "$(docker images -q multivm:latest)" ]; then
        echo "MultiVM image already exists"
    else
        echo -e "${RED}Warning: MultiVM image not found. Please build it first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker images ready${NC}"
}

# Deploy stack
deploy_stack() {
    echo -e "${YELLOW}Deploying MultiVM production stack...${NC}"
    
    # Stop existing deployment if any
    docker-compose -f docker-compose.production.yml down 2>/dev/null || true
    
    # Start production stack
    docker-compose -f docker-compose.production.yml up -d
    
    echo -e "${GREEN}✓ Stack deployed${NC}"
}

# Wait for services
wait_for_services() {
    echo -e "${YELLOW}Waiting for services to be ready...${NC}"
    
    # Wait for nodes
    for i in 1 2 3; do
        echo -n "Waiting for node $i..."
        while ! docker exec multivm-node$i-prod curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; do
            sleep 2
            echo -n "."
        done
        echo " Ready!"
    done
    
    # Wait for monitoring
    echo -n "Waiting for Prometheus..."
    while ! curl -s http://localhost:9090/-/ready > /dev/null 2>&1; do
        sleep 2
        echo -n "."
    done
    echo " Ready!"
    
    echo -n "Waiting for Grafana..."
    while ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; do
        sleep 2
        echo -n "."
    done
    echo " Ready!"
    
    echo -e "${GREEN}✓ All services are ready${NC}"
}

# Run health checks
run_health_checks() {
    echo -e "${YELLOW}Running health checks...${NC}"
    
    # Check nodes
    for i in 1 2 3; do
        if docker exec multivm-node$i-prod curl -s http://localhost:8080/api/v1/health | grep -q healthy; then
            echo -e "${GREEN}✓ Node $i is healthy${NC}"
        else
            echo -e "${RED}✗ Node $i is not healthy${NC}"
        fi
    done
    
    # Check load balancer
    if curl -k -s https://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Load balancer is working${NC}"
    else
        echo -e "${RED}✗ Load balancer is not working${NC}"
    fi
    
    # Check monitoring
    if curl -s http://localhost:9090/-/ready > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Prometheus is ready${NC}"
    else
        echo -e "${RED}✗ Prometheus is not ready${NC}"
    fi
    
    if curl -s http://localhost:3001/api/health | grep -q ok; then
        echo -e "${GREEN}✓ Grafana is ready${NC}"
    else
        echo -e "${RED}✗ Grafana is not ready${NC}"
    fi
}

# Print access information
print_access_info() {
    echo -e "${BLUE}\nAccess Information${NC}"
    echo "=================="
    echo "Load Balancer (HTTPS): https://localhost"
    echo "Load Balancer (RPC): https://localhost:8443"
    echo "Grafana Dashboard: http://localhost:3001 (admin/admin)"
    echo "Prometheus: http://localhost:9090"
    echo "Direct Node Access:"
    echo "  - Node 1: http://localhost:8080"
    echo "  - Node 2: http://localhost:8081"
    echo "  - Node 3: http://localhost:8082"
    echo ""
    echo "To view logs:"
    echo "  docker-compose -f docker-compose.production.yml logs -f"
    echo ""
    echo "To stop the deployment:"
    echo "  docker-compose -f docker-compose.production.yml down"
}

# Main execution
main() {
    echo "Starting production deployment..."
    echo ""
    
    check_prerequisites
    create_configs
    build_images
    deploy_stack
    wait_for_services
    run_health_checks
    print_access_info
    
    echo ""
    echo -e "${GREEN}✅ MultiVM production deployment complete!${NC}"
}

# Run main function
main "$@"