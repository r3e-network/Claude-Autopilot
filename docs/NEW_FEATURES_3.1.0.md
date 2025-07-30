# AutoClaude v3.1.0 - New Features Guide

## 🚀 Overview

AutoClaude v3.1.0 introduces powerful productivity features designed to enhance your Claude-powered development workflow. This update focuses on data portability, workflow efficiency, and insightful analytics.

## ✨ New Features

### 1. 📤 Import/Export System

#### Export Queue
Save your entire message queue for backup or sharing:
- **Command**: `Ctrl/Cmd + Shift + P` → "AutoClaude: Export Queue"
- **Features**:
  - Export pending and waiting messages to JSON
  - Preserves message text, status, and attached scripts
  - Perfect for sharing workflows with teammates

#### Import Queue
Load previously exported queues:
- **Command**: `Ctrl/Cmd + Shift + P` → "AutoClaude: Import Queue"
- **Options**:
  - Append to existing queue
  - Replace current queue
  - Merge with conflict resolution

#### Export Settings
Backup your AutoClaude configuration:
- **Command**: `Ctrl/Cmd + Shift + P` → "AutoClaude: Export Settings"
- **Includes**: All extension settings and preferences

### 2. 📋 Message Templates

#### Built-in Templates
Six professional templates for common tasks:

1. **Make Production Ready** - Comprehensive production readiness checklist
2. **Add Comprehensive Tests** - Unit and integration test generation
3. **Refactor Code** - Code cleanup and optimization
4. **Security Audit & Fix** - Security vulnerability scanning
5. **Add New Feature** - Feature development workflow
6. **Optimize Performance** - Performance analysis and improvements

#### Using Templates
- **Keyboard Shortcut**: `Ctrl/Cmd + Shift + T`
- **Command**: "AutoClaude: Use Message Template"
- **Features**:
  - Variable support with prompts
  - Category organization
  - Quick search and filtering

#### Variable Support
Templates can include dynamic variables:
```
Please add tests for {{fileName || "this module"}}
```

### 3. 📊 Queue Statistics Dashboard

#### Real-time Metrics
- **Keyboard Shortcut**: `Ctrl/Cmd + Shift + D`
- **Command**: "AutoClaude: Show Queue Statistics"

#### Dashboard Features
- **Overview Cards**:
  - Total messages
  - Pending/Processing/Completed counts
  - Success rate percentage
  - Average processing time

- **Visual Charts**:
  - Messages by hour (bar chart)
  - Status distribution (pie chart)
  - Peak usage times

- **Performance Insights**:
  - Top 5 most used scripts
  - Error type breakdown
  - Messages per hour rate

### 4. ⌨️ Keyboard Shortcuts

New productivity shortcuts:
- `Ctrl/Cmd + Shift + M` - Add new message
- `Ctrl/Cmd + Shift + S` - Start processing
- `Ctrl/Cmd + Shift + X` - Stop processing
- `Ctrl/Cmd + Shift + T` - Use template
- `Ctrl/Cmd + Shift + D` - Show statistics

## 📝 Usage Examples

### Example 1: Using Templates with Variables
1. Press `Ctrl/Cmd + Shift + T`
2. Select "Add Comprehensive Tests"
3. Enter filename when prompted: `userService.ts`
4. Template expands with your values

### Example 2: Exporting and Sharing Workflows
1. Set up your message queue with tasks
2. Run "Export Queue" command
3. Share the JSON file with teammates
4. They import it to replicate your workflow

### Example 3: Analyzing Performance
1. Press `Ctrl/Cmd + Shift + D`
2. Review peak usage hours
3. Identify bottlenecks from error types
4. Optimize based on insights

## 🔧 Configuration

### Template Management
Access template manager to:
- Create custom templates
- Edit existing templates
- Organize by categories
- Delete unused templates

### Statistics Settings
Configure statistics tracking:
- Data retention period
- Update frequency
- Chart preferences

## 💡 Pro Tips

1. **Template Variables**: Use default values in templates:
   ```
   {{varName || "default value"}}
   ```

2. **Bulk Operations**: Export queue before major changes as backup

3. **Performance Monitoring**: Check statistics weekly to optimize workflows

4. **Keyboard Workflow**: Learn shortcuts for faster operation

## 🐛 Troubleshooting

### Import Issues
- Ensure JSON file is valid
- Check for version compatibility
- Use merge option for conflicts

### Template Variables
- Variable names are case-sensitive
- Use quotes for default values with spaces
- Empty variables use defaults

### Statistics Not Updating
- Refresh the dashboard
- Check if messages are processing
- Restart extension if needed

## 📚 Additional Resources

- [Full Documentation](https://github.com/r3e-network/Claude-Autopilot)
- [Template Examples](https://github.com/r3e-network/Claude-Autopilot/wiki/Templates)
- [Report Issues](https://github.com/r3e-network/Claude-Autopilot/issues)

---

Thank you for using AutoClaude! We hope these new features enhance your development workflow.