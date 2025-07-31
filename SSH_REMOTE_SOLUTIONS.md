# AutoClaude SSH Remote Connection Solutions

## 🎯 Quick Solutions

### **Option 1: Use Terminal Tool on Remote Host (Recommended)**
```bash
# SSH into your remote host
ssh user@remote-host

# Install AutoClaude terminal tool
npm install -g @r3e/autoclaude

# Run in terminal mode
autoclaude terminal
```

### **Option 2: Check Remote Status in VS Code**
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run: `Claude: Check Remote Environment`
3. Follow the guidance provided

## 🔍 Why This Happens

AutoClaude VS Code extension has an architectural limitation when used with Remote SSH:

- **Extension runs locally** on your machine
- **Workspace files are remote** on the SSH host
- **Claude CLI executes locally** but can't access remote files
- **Python wrapper runs locally** but workspace paths are remote

This creates a disconnect where Claude can't read or modify your remote files.

## 🛠️ All Available Solutions

### 1. **Terminal Tool on Remote (Best)**
✅ **Pros**: Full functionality, proper file access, native Claude integration
❌ **Cons**: Different interface than VS Code extension

```bash
# On remote host
npm install -g @r3e/autoclaude
autoclaude terminal
```

### 2. **Local Installation with File Sync**
✅ **Pros**: Use VS Code extension interface
❌ **Cons**: Complex setup, potential sync issues

```bash
# Local machine
# Install SSHFS or similar
sshfs user@remote:/path/to/project /local/mount/point
# Use mounted path as VS Code workspace
```

### 3. **Remote Development Container**
✅ **Pros**: Consistent environment
❌ **Cons**: Requires Docker, more complex setup

Add to `.devcontainer/devcontainer.json`:
```json
{
  "postCreateCommand": "npm install -g @r3e/autoclaude"
}
```

### 4. **VS Code Server (code-server)**
✅ **Pros**: Full VS Code experience on remote
❌ **Cons**: Different access method, resource intensive

```bash
# On remote host
curl -fsSL https://code-server.dev/install.sh | sh
code-server --bind-addr 0.0.0.0:8080
```

## 🚨 Current Limitations

The VS Code extension currently **does not support**:
- SSH Remote Development
- WSL (Windows Subsystem for Linux)
- Dev Containers
- GitHub Codespaces

## 🔮 Future Improvements

We're working on:
1. **Remote-aware extension** that detects SSH context
2. **Remote command execution** using VS Code's remote APIs
3. **File synchronization** for hybrid workflows
4. **Container support** for dev containers and Codespaces

## 📞 Need Help?

1. **Check Status**: Use `Claude: Check Remote Environment` command
2. **Read Guide**: Extension shows detailed instructions for your environment
3. **Try Terminal**: The terminal tool works in all environments
4. **Report Issues**: [GitHub Issues](https://github.com/r3e-network/AutoClaude/issues)

## 💡 Pro Tips

- **Use terminal tool for remote work** - it's specifically designed for this
- **Keep VS Code extension for local projects** - best experience
- **Consider hybrid approach** - terminal for remote, extension for local
- **Check our roadmap** - remote support is coming in future releases