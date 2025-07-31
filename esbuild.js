const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/extension.js',
    external: ['vscode'],
    logLevel: 'info',
    plugins: [
      {
        name: 'copy-files',
        setup(build) {
          const fs = require('fs');
          const fsp = fs.promises;
          
          build.onEnd(async () => {
            // Copy Python wrapper
            const pythonSrc = path.join(__dirname, 'src', 'claude_pty_wrapper.py');
            const pythonDest = path.join(__dirname, 'out', 'claude', 'session', 'claude_pty_wrapper.py');
            
            // Ensure directory exists
            await fsp.mkdir(path.dirname(pythonDest), { recursive: true });
            await fsp.copyFile(pythonSrc, pythonDest);
            
            // Copy webview files
            const webviewSrc = path.join(__dirname, 'src', 'webview');
            const webviewDest = path.join(__dirname, 'out', 'webview');
            
            // Function to copy directory recursively
            async function copyDir(src, dest) {
              await fsp.mkdir(dest, { recursive: true });
              const entries = await fsp.readdir(src, { withFileTypes: true });
              
              for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);
                
                if (entry.isDirectory()) {
                  await copyDir(srcPath, destPath);
                } else {
                  await fsp.copyFile(srcPath, destPath);
                }
              }
            }
            
            await copyDir(webviewSrc, webviewDest);
            console.log('Copied Python wrapper and webview files');
          });
        }
      }
    ]
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});