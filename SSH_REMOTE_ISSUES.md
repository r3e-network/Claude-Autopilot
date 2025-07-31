# AutoClaude SSH Remote Connection Issues

## Problem Summary

AutoClaude extension doesn't work properly when connected to a remote host via SSH because:

1. **Process Execution Context**: The extension spawns Claude CLI and Python processes locally, not on the remote host
2. **File System Disconnect**: Workspace files are on the remote host, but Claude runs locally and can't access them
3. **Dependency Mismatch**: Claude CLI and Python need to be installed locally, even though you're working on remote files

## Root Causes

### 1. Local Process Spawning
```typescript
// In src/claude/session/index.ts
spawnedProcess = spawn(pythonPath, args, {
    cwd: cwd,  // This is a remote path when using SSH
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
});
```

### 2. Extension Manifest Configuration
The extension doesn't declare `extensionKind` in package.json, so VS Code decides where to run it. Currently, it runs in the local Extension Host.

### 3. File Access Issues
- Claude CLI runs locally and tries to read/write files using remote paths
- The Python PTY wrapper can't access remote files
- Working directory is set to remote path but process runs locally

## Immediate Workarounds

### Option 1: Use Terminal Tool on Remote
1. SSH into your remote host
2. Install the terminal version directly on remote:
   ```bash
   npm install -g @r3e/autoclaude
   ```
3. Run `autoclaude terminal` on the remote host

### Option 2: Install Dependencies Locally
1. Install Claude CLI on your local machine
2. Install Python 3.8+ locally
3. Mount remote filesystem locally (SSHFS/NFS)
4. Use the mounted path as workspace

### Option 3: Use VS Code Server
1. Install code-server on remote host
2. Access VS Code through browser
3. Extension will run in the correct context

## Long-term Solutions

### 1. Make Extension Remote-Aware

Add to package.json:
```json
{
  "extensionKind": ["workspace"],
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": false
    }
  }
}
```

### 2. Detect Remote Context

```typescript
import * as vscode from 'vscode';

function isRemoteEnvironment(): boolean {
    return vscode.env.remoteName !== undefined;
}

function getRemoteType(): string | undefined {
    // Returns 'ssh-remote', 'wsl', 'dev-container', etc.
    return vscode.env.remoteName;
}
```

### 3. Conditional Process Spawning

```typescript
async function spawnClaudeProcess() {
    if (isRemoteEnvironment()) {
        // Option A: Show error and guide user
        vscode.window.showErrorMessage(
            'AutoClaude requires Claude CLI on the remote host. ' +
            'Please install it via terminal on the remote machine.'
        );
        
        // Option B: Use remote command execution
        await vscode.commands.executeCommand(
            'remote-ssh.runCommand',
            'claude --version'
        );
    } else {
        // Current local spawning logic
    }
}
```

### 4. Remote File Sync Approach

```typescript
class RemoteFileSync {
    async syncToLocal(remotePath: string): Promise<string> {
        // Copy remote file to temp local directory
        const localTemp = path.join(os.tmpdir(), 'autoclaude-remote');
        // Use VS Code's file system API
        const remoteUri = vscode.Uri.parse(`vscode-remote://${remotePath}`);
        const content = await vscode.workspace.fs.readFile(remoteUri);
        // Save locally and return path
    }
}
```

### 5. Remote Command Execution

```typescript
class RemoteExecutor {
    async executeRemoteCommand(command: string): Promise<string> {
        // Use VS Code's remote execution API
        const terminal = vscode.window.createTerminal({
            name: 'AutoClaude Remote',
            hideFromUser: true
        });
        
        terminal.sendText(command);
        // Capture output (requires terminal API enhancements)
    }
}
```

## Recommended Approach

1. **Short-term**: Document the limitation and provide clear instructions for remote usage
2. **Medium-term**: Add remote detection and show appropriate warnings/guidance
3. **Long-term**: Implement proper remote execution support

## Testing Remote Support

1. Set up test environment:
   ```bash
   # Local machine
   code --remote ssh-remote+hostname /path/to/project
   ```

2. Test scenarios:
   - File reading/writing
   - Process spawning
   - Terminal creation
   - Path resolution

3. Verify with different remote types:
   - SSH Remote
   - WSL
   - Dev Containers
   - GitHub Codespaces