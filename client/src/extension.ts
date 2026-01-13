import * as path from 'path';
import { workspace, ExtensionContext, commands, window, WebviewPanel, ViewColumn } from 'vscode';
import * as plantumlEncoder from 'plantuml-encoder';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;
let previewPanel: WebviewPanel | undefined;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'plantuml' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'plantumlLSP',
		'PlantUML Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	// Register the preview command
	context.subscriptions.push(
		commands.registerCommand('plantuml-lsp.preview', () => {
			if (previewPanel) {
				previewPanel.reveal(ViewColumn.Beside);
			} else {
				previewPanel = window.createWebviewPanel(
					'plantumlPreview',
					'PlantUML Preview',
					ViewColumn.Beside,
					{
						enableScripts: true
					}
				);
				previewPanel.onDidDispose(() => {
					previewPanel = undefined;
				}, null, context.subscriptions);
			}
			updatePreview();
		})
	);

	// Update preview when active editor changes or document is saved
	workspace.onDidChangeTextDocument(e => {
		if (previewPanel && e.document === window.activeTextEditor?.document) {
			updatePreview();
		}
	}, null, context.subscriptions);

	window.onDidChangeActiveTextEditor(editor => {
		if (previewPanel && editor) {
			updatePreview();
		}
	}, null, context.subscriptions);
}

function updatePreview() {
	if (!previewPanel) return;
	const editor = window.activeTextEditor;
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

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
