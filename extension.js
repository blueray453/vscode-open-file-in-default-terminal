// src/extension.js (ES module)
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { dirname } from 'path';


function openAlacrittyTmux(targetDir) {
	return new Promise((resolve, reject) => {
		try {
			const child = spawn(
				'alacritty',
				['--working-directory', targetDir],
				{ detached: true, stdio: 'ignore' }
			);
			child.on('error', reject);
			setTimeout(() => {
				try { child.unref(); } catch (e) { }
				resolve(true);
			}, 200);
		} catch (err) {
			reject(err);
		}
	});
}

export async function activate(context) {
	const disposable = vscode.commands.registerCommand('openFileInDefaultTerminal.open', async (resource) => {
		let fileUri = resource;
		if (!fileUri) {
			const editor = vscode.window.activeTextEditor;
			if (editor) fileUri = editor.document.uri;
		}

		if (!fileUri) {
			vscode.window.showErrorMessage('No file selected.');
			return;
		}

		const filePath = fileUri.fsPath;
		const targetDir = dirname(filePath);

		try {
			await openAlacrittyTmux(targetDir);
		} catch (e) {
			vscode.window.showErrorMessage('Failed to open Alacritty (is it installed?).');
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
// Sample input / output (how to use)
// -------------------------------
// 1) Right-click any file in the Explorer -> you should see:
//      - "Open Containing Folder"
//      - "Open File Path in Default Terminal"   <-- our command (group: navigation@3)
//
// 2) Click the command.
//    - On macOS: tries to open Terminal.app (or iTerm) at the file's folder.
//    - On Windows: tries to open Windows Terminal (wt) or fallback to cmd.exe.
//    - On Linux: probes common terminal emulators (gnome-terminal, konsole, xterm...).
//    - If none of the system terminals are available, opens VS Code integrated terminal at that folder.

// Example: file -> /home/me/projects/foo/src/index.js
// Output: System terminal opens with cwd set to /home/me/projects/foo/src

/*
Visual (text) layout in Explorer context menu (approximate):

┌────────────────────────────────────────────┐
│ Open (Open Editors...)                     │
│ Open Containing Folder                     │  <-- existing
│ Open File Path in Default Terminal         │  <-- our command (navigation@3)
│ Rename                                     │
└────────────────────────────────────────────┘
*/
