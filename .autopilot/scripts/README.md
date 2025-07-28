# Claude Autopilot Scripts

This folder contains quality check scripts that ensure your code meets production standards.

## Built-in Scripts

1. **production-readiness.js** - Scans for TODO, FIXME, placeholders, and incomplete implementations
2. **build-check.js** - Ensures the project builds successfully
3. **test-check.js** - Runs all tests and ensures they pass
4. **format-check.js** - Validates code formatting
5. **github-actions.js** - Checks GitHub Actions workflow syntax and best practices

## Custom Scripts

You can add your own validation scripts to this folder. Scripts must:

1. Be executable JavaScript files (`.js`)
2. Output JSON to stdout in this format:
```json
{
  "passed": true/false,
  "errors": ["error1", "error2"],
  "warnings": ["warning1"] // optional
}
```
3. Exit with code 0 if passed, 1 if failed

## Example Custom Script

```javascript
#!/usr/bin/env node

async function check() {
    const errors = [];
    const warnings = [];
    
    // Your validation logic here
    if (someCondition) {
        errors.push("Found an issue");
    }
    
    return {
        passed: errors.length === 0,
        errors,
        warnings
    };
}

check().then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
}).catch(error => {
    console.error(JSON.stringify({
        passed: false,
        errors: [`Unexpected error: ${error.message}`]
    }, null, 2));
    process.exit(1);
});
```

## Configuration

Scripts are configured in `../.autopilot/config.json`. You can:
- Enable/disable scripts
- Change execution order
- Set max iterations for fix loops

## Running Scripts

Scripts are run automatically by Claude Autopilot when you:
- Click "Run Checks" to validate once
- Click "Run Loop" to fix issues automatically
- Use the 🔄 button on messages for quality loops