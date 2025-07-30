# AutoClaude Context System Overview

## 🚀 New Features Added

### 1. **Automatic Project Context Generation**
- **Project Indexer**: Automatically indexes all files in your workspace
  - Tracks file changes in real-time
  - Extracts symbols (classes, functions, etc.) from code files
  - Calculates project statistics and complexity metrics
  - Detects frameworks, dependencies, and project structure

### 2. **Cross-Session Task Persistence**
- **Task Manager**: Maintains task history across VSCode sessions
  - Tasks persist even after closing VSCode
  - Tracks task status, priority, and context
  - Links Claude messages to specific tasks
  - Maintains relationships between tasks (dependencies, subtasks)

### 3. **Enhanced Context Provider**
- **Smart Context Generation**: Provides relevant context to Claude
  - Generates full project context or targeted file context
  - Includes unfinished tasks and recent changes
  - Tracks which files and commands are involved in each task
  - Automatically saves context to `.autopilot/CLAUDE_CONTEXT.md`

### 4. **Project Learning Engine**
- **Intelligent Insights**: Analyzes your codebase for patterns and issues
  - Detects design patterns (Singleton, Factory, Observer, etc.)
  - Identifies architectural patterns (MVC, Layered Architecture)
  - Provides actionable recommendations
  - Calculates complexity metrics and maintainability index

### 5. **Claude Integration**
- **Message Tracking**: Automatically tracks Claude interactions
  - Links messages to current tasks
  - Extracts mentioned files and commands
  - Detects task intent from user messages

## 📋 New Commands

1. **🔄 Update Project Context** (`autoclaude.updateContext`)
   - Regenerates the full project context
   - Updates `.autopilot/CLAUDE_CONTEXT.md`

2. **📋 Show Project Context** (`autoclaude.showContext`)
   - Opens the current project context file
   - Shows project overview, tasks, and recent changes

3. **📝 Show Task History** (`autoclaude.showTasks`)
   - Displays all tasks with their status
   - Shows task statistics and recent activity

## 🗂️ File Structure

```
.autopilot/
├── cache/
│   └── project-index.json    # Cached project index
├── tasks/
│   ├── tasks.json           # Persisted tasks
│   └── sessions.json        # Session history
└── CLAUDE_CONTEXT.md        # Generated context for Claude
```

## 🔧 How It Works

### Automatic Initialization
When you open a workspace, AutoClaude:
1. Indexes all project files
2. Loads previous tasks and sessions
3. Generates initial project context
4. Sets up file watchers for real-time updates

### Context Updates
The context automatically updates when:
- Files are created, modified, or deleted
- Tasks are created or updated
- Every 5 minutes (configurable refresh)

### Task Tracking
Tasks are automatically created when:
- User messages contain action keywords (fix, implement, create, etc.)
- Claude is actively working on something
- Tasks persist across sessions until marked complete

### Smart Context Generation
When Claude needs context, the system provides:
- Quick context (current file, active task)
- Full project context (complete overview)
- Targeted context (specific file with related tasks)

## 🎯 Benefits

1. **Better Claude Understanding**: Claude has full project context
2. **Task Continuity**: Never lose track of what you were working on
3. **Intelligent Insights**: Get recommendations based on code analysis
4. **Automatic Documentation**: Context file serves as project documentation
5. **Performance Tracking**: See which tasks succeed or fail over time

## 💡 Usage Tips

1. **Start Tasks Clearly**: Use action words in your messages to Claude
2. **Check Context**: Run "Show Project Context" to see what Claude knows
3. **Review Tasks**: Periodically check task history to track progress
4. **Update Context**: Manually update context before complex tasks

## 🔍 Example Context Output

```markdown
# AutoClaude Project Context

Generated at: 2025-01-30T...

## Workspace
- **Root**: /home/user/project
- **Type**: web frontend
- **Last Updated**: 2025-01-30T...

## Statistics
- **Total Files**: 156
- **Estimated Lines**: 12,450
- **Average File Size**: 3,245 bytes

## Languages
- **typescript**: 89 files
- **javascript**: 34 files
- **json**: 23 files

## Unfinished Tasks

### High Priority
#### Fix TypeScript compilation errors
- **Status**: in_progress
- **Created**: 2025-01-30T...
- **Recent Errors**: TS2304: Cannot find name 'TaskContext'
- **Files**: src/context/contextProvider.ts

## Recent Changes
### Git Status
```
M src/extension.ts
A src/context/projectIndexer.ts
A src/context/taskPersistence.ts
```
```

## 🚧 Future Enhancements

- Visual task board in webview
- AI-powered code suggestions based on patterns
- Integration with git commits (auto-link commits to tasks)
- Team collaboration features
- Export reports for project documentation