// src/extension.js (ES module)
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { platform } from 'os';
import { dirname } from 'path';

/**
 * Try to open the system default terminal at `targetDir`.
 * If platform-specific heuristics fail, fall back to VS Code integrated terminal.
 */
async function openSystemTerminal(targetDir) {
	const plt = platform();

	// macOS: `open -a Terminal <dir>` (works for Terminal.app). Try iTerm2 as fallback.
	if (plt === 'darwin') {
		// prefer the user's default terminal: try Terminal, then iTerm
		try {
			await spawnPromise('open', ['-a', 'Terminal', targetDir]);
			return true;
		} catch (e) {
			try {
				await spawnPromise('open', ['-a', 'iTerm', targetDir]);
				return true;
			} catch (e2) {
				return false;
			}
		}
	}

	// Windows: prefer Windows Terminal (wt), then cmd.exe
	if (plt === 'win32') {
		try {
			// 'wt' supports -d <dir>
			await spawnPromise('wt', ['-d', targetDir]);
			return true;
		} catch (e) {
			// fallback to cmd.exe starting in the dir
			try {
				// start cmd.exe and keep it open
				await spawnPromise('cmd', ['/c', 'start', 'cmd.exe', '/K', `cd /d "${targetDir}"`]);
				return true;
			} catch (e2) {
				return false;
			}
		}
	}

	// Linux/other: try common terminal emulators. There's no single "default" API,
	// so we probe a list. If none available, return false.
	if (plt === 'linux') {
		const candidates = [
			['gnome-terminal', ['--', 'bash', '-lc', `cd "${targetDir}"; exec bash`]],
			['konsole', ['--workdir', targetDir]],
			['xfce4-terminal', ['--working-directory', targetDir]],
			['x-terminal-emulator', ['-e', `bash -c 'cd "${targetDir}"; exec bash'`]],
			['xterm', ['-e', `bash -lc 'cd "${targetDir}"; exec bash'`]]
		];

		for (const [cmd, args] of candidates) {
			try {
				await spawnPromise(cmd, args);
				return true;
			} catch (e) {
				// try next
			}
		}
		return false;
	}

	return false;
}

function spawnPromise(cmd, args) {
	return new Promise((resolve, reject) => {
		try {
			const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
			// detach so it doesn't block the extension host
			child.on('error', reject);
			// give it a tiny timeout to surface immediate ENOENT errors
			setTimeout(() => {
				try { child.unref(); } catch (e) { }
				resolve(true);
			}, 200);
		} catch (err) {
			reject(err);
		}
	});
}

/**
 * If system terminal can't be opened, open VS Code integrated terminal at the path.
 */
function openIntegratedTerminal(targetDir, label = 'Open File Path') {
	const terminal = vscode.window.createTerminal({ name: label, cwd: targetDir });
	terminal.show(true);
}

export async function activate(context) {
	const disposable = vscode.commands.registerCommand('openFileInDefaultTerminal.open', async (resource) => {
		// resource is a vscode.Uri when triggered from explorer context menu
		let fileUri = resource;

		// If the command was invoked without a resource, try active editor
		if (!fileUri) {
			const editor = vscode.window.activeTextEditor;
			if (editor) fileUri = editor.document.uri;
		}

		if (!fileUri) {
			vscode.window.showErrorMessage('No file selected to open in terminal.');
			return;
		}

		const filePath = fileUri.fsPath;
		const targetDir = dirname(filePath);

		// Try system terminal first
		const ok = await openSystemTerminal(targetDir);
		if (!ok) {
			// fallback to integrated terminal
			openIntegratedTerminal(targetDir, `Terminal — ${targetDir}`);
			vscode.window.showInformationMessage('Opened VS Code integrated terminal (system terminal not found).');
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	// nothing to clean up
}

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
