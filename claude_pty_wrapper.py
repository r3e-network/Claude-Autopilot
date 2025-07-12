#!/usr/bin/env python3
import pty
import os
import sys
import select
import subprocess

def main():
    # Spawn Claude with a proper PTY
    master, slave = pty.openpty()
    
    # Start Claude process with the slave PTY as its controlling terminal
    claude_process = subprocess.Popen(
        ['claude', '--dangerously-skip-permissions'],
        stdin=slave,
        stdout=slave,
        stderr=slave,
        close_fds=True,
        preexec_fn=os.setsid
    )
    
    # Close the slave end in the parent process
    os.close(slave)
    
    try:
        while claude_process.poll() is None:
            # Use select to handle both reading from master and stdin
            ready, _, _ = select.select([master, sys.stdin], [], [], 0.1)
            
            if master in ready:
                try:
                    # Read from Claude and write to stdout
                    data = os.read(master, 1024)
                    if data:
                        sys.stdout.buffer.write(data)
                        sys.stdout.buffer.flush()
                except OSError:
                    break
            
            if sys.stdin in ready:
                try:
                    # Read from stdin and write to Claude
                    data = sys.stdin.buffer.read(1)
                    if data:
                        os.write(master, data)
                except OSError:
                    break
                    
    except KeyboardInterrupt:
        pass
    finally:
        # Clean up
        claude_process.terminate()
        claude_process.wait()
        os.close(master)

if __name__ == '__main__':
    main() 