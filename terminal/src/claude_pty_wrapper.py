#!/usr/bin/env python3
import pty
import os
import sys
import select
import subprocess
import fcntl
import json

def log_debug(message):
    """Log debug messages to stderr as JSON"""
    sys.stderr.write(json.dumps({"type": "debug", "message": message}) + "\n")
    sys.stderr.flush()

def main():
    # Parse command line arguments
    skip_permissions = '--skip-permissions' in sys.argv
    
    # Spawn Claude with a proper PTY
    master, slave = pty.openpty()
    
    # Start Claude process with the slave PTY as its controlling terminal
    claude_args = ['claude']
    if skip_permissions:
        claude_args.append('--dangerously-skip-permissions')
    
    log_debug(f"Starting Claude with args: {claude_args}")
    
    claude_process = subprocess.Popen(
        claude_args,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        close_fds=True,
        preexec_fn=os.setsid
    )
    
    # Close the slave end in the parent process
    os.close(slave)
    
    # Set stdin to non-blocking mode
    stdin_flags = fcntl.fcntl(sys.stdin.fileno(), fcntl.F_GETFL)
    fcntl.fcntl(sys.stdin.fileno(), fcntl.F_SETFL, stdin_flags | os.O_NONBLOCK)
    
    # Set master to non-blocking mode
    master_flags = fcntl.fcntl(master, fcntl.F_GETFL)
    fcntl.fcntl(master, fcntl.F_SETFL, master_flags | os.O_NONBLOCK)
    
    log_debug("PTY wrapper started successfully")
    
    try:
        while claude_process.poll() is None:
            # Use select to handle both reading from master and stdin
            ready_to_read, _, _ = select.select([master, sys.stdin], [], [], 0.1)
            
            if master in ready_to_read:
                try:
                    # Read from Claude and write to stdout
                    data = os.read(master, 4096)
                    if data:
                        sys.stdout.buffer.write(data)
                        sys.stdout.buffer.flush()
                except OSError as e:
                    if e.errno == 5:  # EIO, process likely ended
                        break
                    elif e.errno == 11:  # EAGAIN, no data available
                        pass
                    else:
                        log_debug(f"Read error: {e}")
                    
            if sys.stdin in ready_to_read:
                try:
                    # Read from stdin and write to Claude
                    data = sys.stdin.buffer.read(4096)
                    if data:
                        os.write(master, data)
                except OSError as e:
                    if e.errno == 11:  # EAGAIN
                        pass
                    else:
                        log_debug(f"Write error: {e}")
                        
    except KeyboardInterrupt:
        log_debug("Received interrupt signal")
        claude_process.terminate()
    except Exception as e:
        log_debug(f"Unexpected error: {e}")
        claude_process.terminate()
    finally:
        os.close(master)
        claude_process.wait()
        log_debug(f"Claude process exited with code: {claude_process.returncode}")

if __name__ == '__main__':
    main()