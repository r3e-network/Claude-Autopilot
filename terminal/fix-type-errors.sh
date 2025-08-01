#!/bin/bash

# Fix remaining TypeScript errors by updating all logger calls

echo "Fixing TypeScript errors in all files..."

# Fix healthMonitor.ts
sed -i "1s/^/import { toLogMetadata, toError } from '..\/utils\/typeGuards';\n/" src/core/healthMonitor.ts
sed -i "s/this.logger.error('Health check error:', error);/this.logger.error('Health check error:', toLogMetadata({ error: toError(error) }));/g" src/core/healthMonitor.ts

# Fix session.ts
sed -i "7s/$/\nimport { toLogMetadata, toError } from '..\/utils\/typeGuards';/" src/core/session.ts
sed -i "s/this.logger.warn(\`Error stopping session during recovery:\`, error);/this.logger.warn(\`Error stopping session during recovery:\`, toLogMetadata({ error: toError(error) }));/g" src/core/session.ts
sed -i "s/this.logger.debug('Sent escape key');/this.logger.debug('Sent escape key');/g" src/core/session.ts

# Fix sessionRecovery.ts
sed -i "6s/$/\nimport { toLogMetadata, toError } from '..\/utils\/typeGuards';/" src/core/sessionRecovery.ts
sed -i "s/this.logger.error('Failed to initialize session:', error);/this.logger.error('Failed to initialize session:', toLogMetadata({ error: toError(error) }));/g" src/core/sessionRecovery.ts
sed -i "s/this.logger.warn('Error stopping session during recovery:', error);/this.logger.warn('Error stopping session during recovery:', toLogMetadata({ error: toError(error) }));/g" src/core/sessionRecovery.ts
sed -i "s/this.logger.error('Recovery failed:', error);/this.logger.error('Recovery failed:', toLogMetadata({ error: toError(error) }));/g" src/core/sessionRecovery.ts

# Fix terminalMode.ts logger errors
sed -i "s/this.logger.error('Failed to initialize message queue:', error);/this.logger.error('Failed to initialize message queue:', toLogMetadata({ error: toError(error) }));/g" src/core/terminalMode.ts
sed -i "s/this.logger.error('Failed to initialize parallel agents:', error);/this.logger.error('Failed to initialize parallel agents:', toLogMetadata({ error: toError(error) }));/g" src/core/terminalMode.ts
sed -i "s/this.logger.warn(\`Claude session initialization failed: \${error}\`);/this.logger.warn(\`Claude session initialization failed: \${toError(error).message}\`);/g" src/core/terminalMode.ts
sed -i "s/this.logger.error('Slash command error:', error);/this.logger.error('Slash command error:', toLogMetadata({ error: toError(error) }));/g" src/core/terminalMode.ts
sed -i "s/this.logger.error('Failed to add message:', error);/this.logger.error('Failed to add message:', toLogMetadata({ error: toError(error) }));/g" src/core/terminalMode.ts
sed -i "s/await this.queue.updateMessageStatus(message.id!, 'error', undefined, error.toString());/await this.queue.updateMessageStatus(message.id!, 'error', undefined, toError(error).toString());/g" src/core/terminalMode.ts
sed -i "s/this.logger.error('Failed to save queue state:', error);/this.logger.error('Failed to save queue state:', toLogMetadata({ error: toError(error) }));/g" src/core/terminalMode.ts
sed -i "s/this.logger.error('Error stopping agents:', error);/this.logger.error('Error stopping agents:', toLogMetadata({ error: toError(error) }));/g" src/core/terminalMode.ts

# Fix index.ts
sed -i "2s/$/\nimport { toLogMetadata, toError } from '.\/utils\/typeGuards';/" src/index.ts
sed -i "s/logger.error('Unhandled error:', error);/logger.error('Unhandled error:', toLogMetadata({ error: toError(error) }));/g" src/index.ts

# Fix messageQueue.ts
sed -i "7s/$/\nimport { toLogMetadata, toError } from '..\/utils\/typeGuards';/" src/queue/messageQueue.ts
sed -i "s/this.logger.error('Failed to load queue from disk:', error);/this.logger.error('Failed to load queue from disk:', toLogMetadata({ error: toError(error) }));/g" src/queue/messageQueue.ts
sed -i "s/this.logger.error('Failed to save queue:', error);/this.logger.error('Failed to save queue:', toLogMetadata({ error: toError(error) }));/g" src/queue/messageQueue.ts
sed -i "s/this.logger.warn('Failed to load queue file:', error);/this.logger.warn('Failed to load queue file:', toLogMetadata({ error: toError(error) }));/g" src/queue/messageQueue.ts

echo "Done! Running TypeScript check..."
npx tsc --noEmit