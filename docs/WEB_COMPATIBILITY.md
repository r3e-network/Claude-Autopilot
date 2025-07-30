# VS Code Web Compatibility Guide

AutoClaude v3.0.1+ is fully compatible with web-based VS Code environments.

## Supported Environments

✅ **VS Code Desktop** - Full support
✅ **VS Code Server** - Full support  
✅ **github.dev** - Full support
✅ **vscode.dev** - Full support
✅ **Codespaces** - Full support
✅ **Remote Development** - Full support

## How It Works

### Resource Loading
- All webview resources are loaded using `asWebviewUri` 
- No file system dependencies for web environments
- Resources are served through VS Code's webview protocol

### Content Security Policy
- CSP configured to work in both desktop and web contexts
- Proper nonce-based script loading for security
- Compatible with VS Code's web security model

### HTML Generation
- Webview HTML is generated inline (no external files)
- All assets use proper URI resolution
- Works seamlessly across all environments

## Technical Details

### Key Changes Made

1. **Resource URIs**
   ```typescript
   // Before (breaks in web)
   const cssPath = path.join(context.extensionPath, 'out', 'webview', 'styles.css');
   
   // After (works everywhere)
   const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'styles.css'));
   ```

2. **Local Resource Roots**
   ```typescript
   localResourceRoots: [
       vscode.Uri.joinPath(context.extensionUri, 'out'),
       vscode.Uri.joinPath(context.extensionUri, 'src'),
       context.extensionUri
   ]
   ```

3. **Content Security Policy**
   ```html
   <meta http-equiv="Content-Security-Policy" 
         content="default-src 'none'; 
                  style-src ${webview.cspSource} 'unsafe-inline'; 
                  script-src 'nonce-${nonce}'; 
                  font-src ${webview.cspSource}; 
                  img-src ${webview.cspSource} data: https:;">
   ```

## Testing

To test in web environments:

1. **github.dev**
   - Navigate to your repo on GitHub
   - Press `.` to open in github.dev
   - Install the extension

2. **vscode.dev**
   - Go to https://vscode.dev
   - Install the extension from marketplace

3. **VS Code Server**
   - Install code-server
   - Access through browser
   - Extension works identically to desktop

## Limitations

- Claude CLI must be installed on the server/container
- Terminal features require server-side access
- File system operations work through VS Code's API

## Troubleshooting

### Blank Webview
- Ensure you're using v3.0.1 or later
- Check browser console for errors
- Verify extension is properly activated

### Resources Not Loading
- Check CSP errors in console
- Ensure localResourceRoots are set
- Verify URIs use asWebviewUri

### Performance Issues
- Web environments may be slower
- Consider reducing parallel agents
- Monitor network latency