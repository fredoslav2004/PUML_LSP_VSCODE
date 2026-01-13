"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager.
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true
            },
            hoverProvider: true
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
async function validateTextDocument(textDocument) {
    // The validator creates diagnostics for all uppercase words length 2 and more
    const text = textDocument.getText();
    const diagnostics = [];
    if (!text.includes('@startuml') && !text.includes('@startmindmap') && !text.includes('@startgantt') && !text.includes('@startwbs')) {
        const diagnostic = {
            severity: node_1.DiagnosticSeverity.Warning,
            range: {
                start: textDocument.positionAt(0),
                end: textDocument.positionAt(text.length > 0 ? 10 : 0)
            },
            message: 'PlantUML diagrams should usually start with @startuml (or other @start tags).',
            source: 'puml-lsp'
        };
        diagnostics.push(diagnostic);
    }
    // Basic logic to check if tags are closed
    const startTags = (text.match(/@start\w+/g) || []).length;
    const endTags = (text.match(/@end\w+/g) || []).length;
    if (startTags > endTags) {
        const diagnostic = {
            severity: node_1.DiagnosticSeverity.Error,
            range: {
                start: textDocument.positionAt(0),
                end: textDocument.positionAt(text.length)
            },
            message: `Missing @end tag. Found ${startTags} start tags and ${endTags} end tags.`,
            source: 'puml-lsp'
        };
        diagnostics.push(diagnostic);
    }
    // Line-by-line validation for keywords
    const lines = text.split(/\r?\n/);
    const validKeywords = [
        'actor', 'boundary', 'control', 'entity', 'database', 'collections', 'participant', 'queue',
        'class', 'interface', 'enum', 'abstract', 'annotation', 'state', 'object', 'package', 'node',
        'folder', 'frame', 'cloud', 'note', 'title', 'header', 'footer', 'caption', 'legend'
    ];
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Skip if empty, comment, tag, or has member/relationship indicators
        if (trimmed.length === 0 ||
            trimmed.startsWith('\'') ||
            trimmed.startsWith('@') ||
            trimmed.startsWith('!') ||
            trimmed.includes('--') ||
            trimmed.includes('..') ||
            trimmed.includes('->') ||
            trimmed.includes('{') ||
            trimmed.includes('}') ||
            trimmed.includes(':') || // likely a field
            trimmed.includes('(') || // likely a method
            line.startsWith(' ') || // indented lines are usually members
            line.startsWith('\t')) {
            return;
        }
        // Simple check: if a line starts with a word that is not a known keyword but looks like one
        const firstWord = trimmed.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');
        if (firstWord.length > 3 && !validKeywords.includes(firstWord) && /^[a-z]+$/.test(firstWord)) {
            // Check if it's close to a valid keyword (extremely basic fuzzy match)
            for (const kw of validKeywords) {
                if (isClose(firstWord, kw)) {
                    diagnostics.push({
                        severity: node_1.DiagnosticSeverity.Error,
                        range: {
                            start: { line: i, character: line.indexOf(firstWord) },
                            end: { line: i, character: line.indexOf(firstWord) + firstWord.length }
                        },
                        message: `Unrecognized keyword "${firstWord}". Did you mean "${kw}"?`,
                        source: 'puml-lsp'
                    });
                    break;
                }
            }
        }
    });
    // Send the computed diagnostics to VS Code.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
function isClose(s1, s2) {
    if (Math.abs(s1.length - s2.length) > 2)
        return false;
    let dist = 0;
    const len = Math.min(s1.length, s2.length);
    for (let i = 0; i < len; i++) {
        if (s1[i] !== s2[i])
            dist++;
    }
    return dist <= 2;
}
connection.onDidChangeConfiguration(_change => {
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition) => {
    const keywords = [
        '@startuml', '@enduml', '@startmindmap', '@endmindmap', '@startgantt', '@endgantt',
        'participant', 'actor', 'boundary', 'control', 'entity', 'database', 'collections', 'queue',
        'class', 'interface', 'enum', 'abstract', 'annotation', 'package', 'node', 'folder', 'frame', 'cloud', 'database',
        'autonumber', 'newpage', 'title', 'header', 'footer', 'caption', 'legend',
        'note left', 'note right', 'note top', 'note bottom', 'note over',
        'activate', 'deactivate', 'destroy', 'return',
        'if', 'then', 'else', 'endif', 'while', 'endwhile', 'fork', 'endfork', 'repeat', 'until', 'loop'
    ];
    return keywords.map((k, index) => ({
        label: k,
        kind: k.startsWith('@') ? node_1.CompletionItemKind.Event : node_1.CompletionItemKind.Keyword,
        data: index
    }));
});
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    if (item.label === '@startuml') {
        item.detail = 'Start Sequence/Class Diagram';
        item.documentation = 'Starts a standard PlantUML diagram.';
    }
    else if (item.label === 'participant') {
        item.detail = 'Declare Participant';
        item.documentation = 'explicitly declare a participant in a sequence diagram.';
    }
    return item;
});
connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return null;
    // Simple hover for keywords
    // In a real LSP we'd check the token at the position
    return {
        contents: {
            kind: 'markdown',
            value: 'PlantUML Keyword'
        }
    };
});
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map