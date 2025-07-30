# Automatic Orchestration Guide

AutoClaude's Parallel Agent Farm now includes **fully automatic orchestration** - a complete hands-off automation system that detects work, starts agents, distributes tasks, monitors progress, and shuts down when complete.

## 🚀 Quick Start - One Command Setup

```
1. Open VS Code Command Palette (Cmd/Ctrl + Shift + P)
2. Run: "Claude Agent Farm: Toggle Auto-Orchestration (On/Off)"
3. That's it! AutoClaude handles everything else automatically.
```

## 🤖 How Automatic Orchestration Works

### 1. **Automatic Work Detection**
- Scans your codebase for issues on startup
- Runs type checking, linting, and tests
- Detects TODOs, FIXMEs, and incomplete implementations
- Identifies tech stack automatically
- Calculates optimal agent count based on workload

### 2. **Automatic Agent Management**
- Starts the right number of agents for your workload
- Scales up when work queue grows
- Scales down when agents are idle
- Restarts failed agents automatically
- Manages context usage proactively

### 3. **Automatic Work Distribution**
- Assigns tasks to idle agents intelligently
- Prevents conflicts between agents
- Redistributes stale work automatically
- Prioritizes critical errors over warnings
- Balances workload across all agents

### 4. **Automatic Progress Monitoring**
- Real-time dashboard updates
- Progress notifications
- Completion detection
- Performance metrics tracking
- Automatic report generation

### 5. **Automatic Completion & Shutdown**
- Detects when all work is complete
- Generates final report
- Gracefully shuts down agents
- Cleans up resources
- Shows completion summary

## ⚙️ Configuration

All automation features can be configured in VS Code settings:

```json
{
  // Master switches
  "autoclaude.parallelAgents.enabled": true,
  "autoclaude.parallelAgents.autoStart": true,
  
  // Automation features
  "autoclaude.parallelAgents.autoDetectWork": true,
  "autoclaude.parallelAgents.autoScale": true,
  "autoclaude.parallelAgents.autoShutdown": true,
  
  // Timing
  "autoclaude.parallelAgents.workDetectionInterval": 60,
  
  // Limits
  "autoclaude.parallelAgents.maxAgents": 50,
  "autoclaude.parallelAgents.defaultAgents": 5
}
```

## 📊 Automatic Features in Detail

### Work Detection
- **Type Checking**: `tsc`, `mypy`, `cargo check`, etc.
- **Linting**: `eslint`, `ruff`, `golangci-lint`, etc.
- **Testing**: `jest`, `pytest`, `cargo test`, etc.
- **Custom Checks**: Your `.autopilot/scripts/` checks

### Agent Scaling Algorithm
```
Work Items | Suggested Agents
-----------|----------------
1-10       | 1
11-50      | 2-5
51-200     | 5-10
201-500    | 10-20
500+       | 20-50
```

### Automatic Workflows

#### Scenario 1: New Project Setup
```
1. Open project in VS Code
2. Enable auto-orchestration
3. System detects missing tests, docs, types
4. Starts 10 agents automatically
5. Agents add comprehensive tests
6. Agents generate documentation
7. Agents add type annotations
8. All complete - agents shut down
9. Final report shows all improvements
```

#### Scenario 2: Pre-Deployment Cleanup
```
1. Toggle auto-orchestration ON
2. System runs all quality checks
3. Detects 147 issues across codebase
4. Starts 15 agents to fix in parallel
5. Agents fix linting errors
6. Agents fix failing tests
7. Agents remove TODOs
8. Zero issues remain
9. Ready for deployment!
```

#### Scenario 3: Continuous Improvement
```
1. Enable with autoStart in settings
2. Every time VS Code opens:
   - Scans for new issues
   - Starts agents if needed
   - Fixes problems automatically
   - Shuts down when clean
3. Your code stays pristine!
```

## 🎯 Best Practices

### For Maximum Automation

1. **Enable All Auto Features**
   ```json
   {
     "autoclaude.parallelAgents.autoStart": true,
     "autoclaude.parallelAgents.autoDetectWork": true,
     "autoclaude.parallelAgents.autoScale": true,
     "autoclaude.parallelAgents.autoShutdown": true
   }
   ```

2. **Configure Your Tech Stack**
   - AutoClaude auto-detects most stacks
   - For custom setups, configure problem commands
   - Add custom scripts to `.autopilot/scripts/`

3. **Set Appropriate Limits**
   - Start with 5-10 max agents
   - Increase based on your machine's capacity
   - Each agent uses ~500MB RAM

4. **Use Scheduled Runs**
   - Enable autoStart for daily cleanup
   - Run overnight for large codebases
   - Schedule during low-activity periods

### Monitoring Automation

Even though everything is automatic, you can:
- View real-time progress in the dashboard
- Check agent status anytime
- Review generated reports
- Adjust settings on the fly

## 🔧 Troubleshooting

### Agents Not Starting Automatically
- Check if workspace folder is open
- Verify tmux is installed
- Ensure Claude Code is accessible
- Check VS Code output panel for errors

### Work Not Being Detected
- Verify tech stack is detected correctly
- Check if problem commands are configured
- Ensure project has package.json/requirements.txt/etc.
- Look for compilation/lint command errors

### Agents Not Scaling
- Check autoScale setting is enabled
- Verify maxAgents limit not reached
- Ensure enough system resources
- Check workload warrants scaling

## 💡 Advanced Automation

### Custom Work Detection
Create `.autopilot/detect_work.sh`:
```bash
#!/bin/bash
# Custom work detection script
echo "src/legacy.js:1:1: TODO: Refactor legacy code"
echo "src/api.ts:50:10: TODO: Add error handling"
```

### Coordination Protocol
Enable for complex multi-file changes:
```json
{
  "autoclaude.parallelAgents.coordinationEnabled": true
}
```

### Scheduled Automation
Combine with VS Code tasks:
```json
{
  "version": "2.0.0",
  "tasks": [{
    "label": "Daily Code Cleanup",
    "type": "shell",
    "command": "code --command autoclaude.toggleAutoOrchestration",
    "problemMatcher": []
  }]
}
```

## 🎉 The Magic of Full Automation

With automatic orchestration enabled, AutoClaude becomes your:
- **24/7 Code Quality Guardian**
- **Automatic Technical Debt Eliminator**  
- **Continuous Improvement Engine**
- **Zero-Touch Deployment Preparer**

Just toggle it on, and let the AI army handle the rest!

## 📈 Performance & Efficiency

- **Time Saved**: 90%+ reduction in manual code cleanup
- **Parallel Efficiency**: 10-50x faster than sequential fixing
- **Quality Improvement**: Consistent standards across codebase
- **Developer Focus**: Spend time on features, not fixes

## 🚦 Status Indicators

The system provides clear status updates:
- 🟢 **Running**: Agents actively working
- 🟡 **Detecting**: Scanning for work
- 🔵 **Scaling**: Adjusting agent count
- ⚪ **Idle**: No work detected
- 🔴 **Complete**: All work finished

Start your journey to a self-maintaining codebase today!