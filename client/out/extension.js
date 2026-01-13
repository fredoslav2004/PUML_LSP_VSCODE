"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = __importStar(require("path"));
const vscode_1 = require("vscode");
const plantumlEncoder = __importStar(require("plantuml-encoder"));
const node_1 = require("vscode-languageclient/node");
let client;
let previewPanel;
function activate(context) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'plantuml' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // Create the language client and start the client.
    client = new node_1.LanguageClient('plantumlLSP', 'PlantUML Language Server', serverOptions, clientOptions);
    // Start the client. This will also launch the server
    client.start();
    // Register the preview command
    context.subscriptions.push(vscode_1.commands.registerCommand('plantuml-lsp.preview', () => {
        if (previewPanel) {
            previewPanel.reveal(vscode_1.ViewColumn.Beside);
        }
        else {
            previewPanel = vscode_1.window.createWebviewPanel('plantumlPreview', 'PlantUML Preview', vscode_1.ViewColumn.Beside, {
                enableScripts: true
            });
            previewPanel.onDidDispose(() => {
                previewPanel = undefined;
            }, null, context.subscriptions);
        }
        updatePreview();
    }));
    // Update preview when active editor changes or document is saved
    vscode_1.workspace.onDidChangeTextDocument(e => {
        if (previewPanel && e.document === vscode_1.window.activeTextEditor?.document) {
            updatePreview();
        }
    }, null, context.subscriptions);
    vscode_1.window.onDidChangeActiveTextEditor(editor => {
        if (previewPanel && editor) {
            updatePreview();
        }
    }, null, context.subscriptions);
}
exports.activate = activate;
function updatePreview() {
    if (!previewPanel)
        return;
    const editor = vscode_1.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'plantuml') {
        previewPanel.webview.html = '<h1>Not a PlantUML file</h1>';
        return;
    }
    const text = editor.document.getText();
    const encoded = plantumlEncoder.encode(text);
    const url = `http://www.plantuml.com/plantuml/svg/${encoded}`;
    previewPanel.webview.html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>PlantUML Preview</title>
			<style>
				body { display: flex; justify-content: center; background-color: white; padding: 20px; }
				img { max-width: 100%; height: auto; }
			</style>
		</head>
		<body>
			<img src="${url}" alt="PlantUML Diagram" />
		</body>
		</html>
	`;
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map