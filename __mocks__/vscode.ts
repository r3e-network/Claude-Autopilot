// Mock VS Code API for testing
export enum ViewColumn {
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
    Active = -1,
    Beside = -2
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
}

export enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15
}

export interface Uri {
    fsPath: string;
    path: string;
    scheme: string;
}

export interface WorkspaceFolder {
    uri: Uri;
    name: string;
    index: number;
}

export interface CancellationToken {
    isCancellationRequested: boolean;
    onCancellationRequested: any;
}

export interface Progress<T> {
    report(value: T): void;
}

export interface ProgressOptions {
    location: ProgressLocation;
    title?: string;
    cancellable?: boolean;
}

export interface WorkspaceConfiguration {
    get(section: string, defaultValue?: any): any;
    has(section: string): boolean;
    inspect(section: string): any;
    update(section: string, value: any, target?: ConfigurationTarget): Thenable<void>;
}

export interface OutputChannel {
    name: string;
    append(value: string): void;
    appendLine(value: string): void;
    clear(): void;
    dispose(): void;
    hide(): void;
    show(preserveFocus?: boolean): void;
}

export interface WebviewPanel {
    webview: any;
    dispose(): void;
    reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;
    onDidDispose: any;
}

export interface ExtensionContext {
    subscriptions: any[];
    workspaceState: any;
    globalState: any;
    extensionPath: string;
    storagePath?: string;
    globalStoragePath: string;
    logPath: string;
}

export interface FileSystemWatcher {
    onDidChange: any;
    onDidCreate: any;
    onDidDelete: any;
    dispose(): void;
}

export interface TextDocument {
    uri: Uri;
    fileName: string;
    isUntitled: boolean;
    languageId: string;
    version: number;
    isDirty: boolean;
    isClosed: boolean;
    save(): Thenable<boolean>;
    lineCount: number;
    lineAt(line: number): any;
    offsetAt(position: any): number;
    positionAt(offset: number): any;
    getText(range?: any): string;
    getWordRangeAtPosition(position: any, regex?: RegExp): any | undefined;
    validateRange(range: any): any;
    validatePosition(position: any): any;
}

export interface TextEditor {
    document: TextDocument;
    selection: any;
    selections: any[];
    options: any;
    viewColumn?: ViewColumn;
    edit(callback: (editBuilder: any) => void): Thenable<boolean>;
    insertSnippet(snippet: any, location?: any): Thenable<boolean>;
    setDecorations(decorationType: any, rangesOrOptions: any[]): void;
    revealRange(range: any, revealType?: any): void;
}

const mockWindow = {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showInputBox: jest.fn().mockResolvedValue(undefined),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    createWebviewPanel: jest.fn().mockReturnValue({
        webview: {
            html: '',
            onDidReceiveMessage: jest.fn(),
            postMessage: jest.fn(),
            asWebviewUri: jest.fn((uri) => uri)
        },
        dispose: jest.fn(),
        reveal: jest.fn(),
        onDidDispose: jest.fn()
    }),
    createOutputChannel: jest.fn().mockReturnValue({
        append: jest.fn(),
        appendLine: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn(),
        hide: jest.fn(),
        show: jest.fn()
    }),
    withProgress: jest.fn().mockImplementation((options, task) => {
        return task({
            report: jest.fn()
        }, {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn()
        });
    }),
    createTextEditorDecorationType: jest.fn(),
    showTextDocument: jest.fn().mockResolvedValue({
        document: {
            uri: { fsPath: '/test/file.ts' },
            getText: jest.fn().mockReturnValue('')
        }
    }),
    activeTextEditor: undefined
};

const mockWorkspace = {
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
        has: jest.fn().mockReturnValue(false),
        inspect: jest.fn().mockReturnValue(undefined),
        update: jest.fn().mockResolvedValue(undefined)
    }),
    workspaceFolders: [{
        uri: { fsPath: '/test/workspace', path: '/test/workspace', scheme: 'file' },
        name: 'test-workspace',
        index: 0
    }],
    createFileSystemWatcher: jest.fn().mockReturnValue({
        onDidChange: jest.fn(),
        onDidCreate: jest.fn(),
        onDidDelete: jest.fn(),
        dispose: jest.fn()
    }),
    openTextDocument: jest.fn().mockResolvedValue({
        uri: { fsPath: '/test/file.ts' },
        getText: jest.fn().mockReturnValue(''),
        languageId: 'typescript'
    }),
    onDidChangeConfiguration: jest.fn(),
    fs: {
        readFile: jest.fn().mockResolvedValue(Buffer.from('')),
        writeFile: jest.fn().mockResolvedValue(undefined),
        stat: jest.fn().mockResolvedValue({ type: 1 }),
        readDirectory: jest.fn().mockResolvedValue([])
    }
};

const mockCommands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn().mockResolvedValue(undefined),
    getCommands: jest.fn().mockResolvedValue([])
};

const mockLanguages = {
    createDiagnosticCollection: jest.fn().mockReturnValue({
        set: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn()
    })
};

const mockUri = {
    file: jest.fn((path) => ({ fsPath: path, path, scheme: 'file' })),
    parse: jest.fn((str) => ({ fsPath: str, path: str, scheme: 'file' }))
};

export const window = mockWindow;
export const workspace = mockWorkspace;
export const commands = mockCommands;
export const languages = mockLanguages;
export const Uri = mockUri;

export default {
    window: mockWindow,
    workspace: mockWorkspace,
    commands: mockCommands,
    languages: mockLanguages,
    Uri: mockUri,
    ViewColumn,
    ConfigurationTarget,
    ProgressLocation
};