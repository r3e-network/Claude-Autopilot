#!/usr/bin/env python3
import pty
import os
import sys
import select
import subprocess
import fcntl
import json
import signal
import threading
import queue
import time

def log_debug(message):
    """Log debug messages to stderr as JSON"""
    sys.stderr.write(json.dumps({"type": "debug", "message": message}) + "\n")
    sys.stderr.flush()

def main():
    # Parse command line arguments
    skip_permissions = '--skip-permissions' in sys.argv
    
    # Set up signal handlers
    signal.signal(signal.SIGTERM, lambda sig, frame: sys.exit(0))
    signal.signal(signal.SIGPIPE, signal.SIG_IGN)  # Ignore broken pipe
    
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
    
    # Buffer to detect permission prompts
    output_buffer = b""
    permission_prompt_detected = False
    
    # Output queue to prevent blocking
    output_queue = queue.Queue(maxsize=1000)
    
    # Start output writer thread
    def output_writer():
        while True:
            try:
                data = output_queue.get(timeout=0.1)
                if data is None:  # Shutdown signal
                    break
                sys.stdout.buffer.write(data)
                sys.stdout.buffer.flush()
            except queue.Empty:
                continue
            except Exception as e:
                log_debug(f"Output writer error: {e}")
                break
    
    writer_thread = threading.Thread(target=output_writer, daemon=True)
    writer_thread.start()
    
    # Track last activity time
    last_activity = time.time()
    
    try:
        while claude_process.poll() is None:
            # Use select to handle both reading from master and stdin
            ready_to_read, _, _ = select.select([master, sys.stdin], [], [], 0.1)
            
            if master in ready_to_read:
                try:
                    # Read from Claude and write to stdout
                    data = os.read(master, 4096)
                    if data:
                        # Add to buffer for permission prompt detection
                        output_buffer += data
                        
                        # Check for permission prompt and auto-respond if skip_permissions is enabled
                        if skip_permissions and not permission_prompt_detected:
                            buffer_str = output_buffer.decode('utf-8', errors='ignore')
                            if ("Bypass Permissions mode" in buffer_str and 
                                "1. No, exit" in buffer_str and 
                                "2. Yes, I accept" in buffer_str):
                                permission_prompt_detected = True
                                log_debug("Permission prompt detected, auto-accepting...")
                                # Send "2" + Enter to accept
                                os.write(master, b"2\n")
                                # Clear the buffer to avoid re-detection
                                output_buffer = b""
                                continue
                        
                        # Keep buffer manageable (last 2KB only)
                        if len(output_buffer) > 2048:
                            output_buffer = output_buffer[-1024:]
                        
                        # Queue output instead of direct write to prevent blocking
                        try:
                            output_queue.put(data, block=False)
                            last_activity = time.time()
                        except queue.Full:
                            log_debug("Output queue full, dropping data")
                            # Clear some space in queue
                            try:
                                output_queue.get_nowait()
                                output_queue.put(data, block=False)
                            except:
                                pass
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
                        # Write in chunks to prevent blocking
                        written = 0
                        while written < len(data):
                            try:
                                n = os.write(master, data[written:])
                                written += n
                                last_activity = time.time()
                            except OSError as e:
                                if e.errno == 11:  # EAGAIN - try again
                                    time.sleep(0.01)
                                else:
                                    raise
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
        # Signal writer thread to stop
        output_queue.put(None)
        writer_thread.join(timeout=1)
        
        os.close(master)
        claude_process.wait()
        log_debug(f"Claude process exited with code: {claude_process.returncode}")

if __name__ == '__main__':
    main()