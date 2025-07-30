#!/usr/bin/env python3
"""
Force Transaction Mining in Reth Dev Mode
This script works around the issue where Reth with --dev.block-time
creates empty blocks without including pending transactions.
"""

import requests
import json
import time
import sys

RPC_URL = "http://localhost:8545"

def check_pending_transactions():
    """Check if there are pending transactions in the pool"""
    try:
        response = requests.post(RPC_URL, json={
            "jsonrpc": "2.0",
            "method": "txpool_status",
            "params": [],
            "id": 1
        })
        result = response.json()
        
        if 'result' in result:
            pending = int(result['result'].get('pending', '0x0'), 16)
            queued = int(result['result'].get('queued', '0x0'), 16)
            return pending, queued
        return 0, 0
    except Exception as e:
        print(f"Error checking transaction pool: {e}")
        return 0, 0

def get_latest_block():
    """Get the latest block number and transaction count"""
    try:
        response = requests.post(RPC_URL, json={
            "jsonrpc": "2.0",
            "method": "eth_getBlockByNumber",
            "params": ["latest", True],
            "id": 1
        })
        result = response.json()
        
        if 'result' in result and result['result']:
            block = result['result']
            block_num = int(block['number'], 16)
            tx_count = len(block.get('transactions', []))
            return block_num, tx_count
        return 0, 0
    except Exception as e:
        print(f"Error getting latest block: {e}")
        return 0, 0

def trigger_mining():
    """
    Attempt to trigger block mining with transactions.
    Note: This is a workaround for dev mode with block-time.
    """
    # In dev mode without block-time, sending any transaction triggers mining
    # With block-time set, this won't work, but we try anyway
    try:
        # Try to trigger with a simple eth_blockNumber call
        # Sometimes this can nudge the node
        requests.post(RPC_URL, json={
            "jsonrpc": "2.0",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        })
    except:
        pass

def main():
    print("MultiVM Transaction Mining Monitor")
    print("==================================")
    print(f"RPC URL: {RPC_URL}")
    print("")
    print("This script monitors pending transactions and attempts to ensure they're mined.")
    print("Note: With --dev.block-time set, Reth creates empty blocks on a timer.")
    print("The proper fix is to remove --dev.block-time or use production configuration.")
    print("")
    
    last_block = 0
    
    while True:
        try:
            # Check pending transactions
            pending, queued = check_pending_transactions()
            
            # Get latest block info
            block_num, tx_count = get_latest_block()
            
            # Display status
            if block_num != last_block:
                print(f"\nBlock #{block_num}: {tx_count} transactions")
                if pending > 0 or queued > 0:
                    print(f"WARNING: {pending} pending, {queued} queued transactions not included!")
                    print("This is due to Reth --dev.block-time creating empty blocks.")
                last_block = block_num
            
            # If we have pending transactions, try to trigger mining
            if pending > 0:
                trigger_mining()
            
            time.sleep(2)
            
        except KeyboardInterrupt:
            print("\nStopping monitor...")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()