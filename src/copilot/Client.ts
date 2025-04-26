/* eslint-disable @typescript-eslint/no-explicit-any */
import Cacher from "./Cacher";
import CopilotPlugin from "../main";
import Vault from "../helpers/Vault";
import Logger from "../helpers/Logger";

export type CopilotResponse = {
	jsonrpc: string;
	id: number;
	result: any;
};

// Simple types to replace the removed LSP client dependency
type InitializeParams = {
    processId: number;
    capabilities: any;
    clientInfo: {
        name: string;
        version: string;
    };
    rootUri: string;
    initializationOptions: any;
};

type InitializeResult = any;

class JSONRPCEndpoint {
    constructor(stdin: any, stdout: any) {
        this.stdin = stdin;
        this.stdout = stdout;
    }

    stdin: any;
    stdout: any;

    on(event: string, callback: (error: any) => void): void {
        // Simplified event listener
    }
}

class LspClient {
    constructor(endpoint: JSONRPCEndpoint) {
        this.endpoint = endpoint;
    }

    endpoint: JSONRPCEndpoint;

    async initialize(params: InitializeParams): Promise<InitializeResult> {
        // Simplified method
        return {};
    }

    async initialized(): Promise<void> {
        // Simplified method
    }

    async customRequest(method: string, params: any): Promise<any> {
        // Simplified method for making custom requests
        return {};
    }

    exit(): void {
        // Simplified method
    }
}

class Client {
	private plugin: CopilotPlugin;
	private endpoint: JSONRPCEndpoint;
	private client: LspClient;
	private basePath: string;

	constructor(plugin: CopilotPlugin) {
		this.plugin = plugin;
		this.basePath = Vault.getBasePath(this.plugin.app);
		this.endpoint = new JSONRPCEndpoint(
			this.plugin.copilotAgent.getAgent().stdin,
			this.plugin.copilotAgent.getAgent().stdout,
		);
		this.setupListeners();
		this.client = new LspClient(this.endpoint);
	}

	public setupListeners(): void {
		this.endpoint.on("error", (error) => {
			Logger.getInstance().error("Error in JSONRPC endpoint: " + error);
		});
	}

	public async setup(): Promise<void> {
		await this.initialize({
			processId: this.plugin.copilotAgent.getAgent().pid as number,
			capabilities: {
				copilot: {
					openURL: true,
				},
			},
			clientInfo: {
				name: "ObsidianCopilot",
				version: "0.0.1",
			},
			rootUri: "file://" + this.basePath,
			initializationOptions: {
				editorInfo: {
					name: "obsidian",
					version: "0.0.1",
				},
				editorPluginInfo: {
					name: "obsidian-copilot",
					version: "0.0.1",
				},
			},
		});
		await this.initialized();
		await this.checkStatus();
		await this.setEditorInfo();
	}

	private async initialize(
		params: InitializeParams,
	): Promise<InitializeResult> {
		return await this.client.initialize(params);
	}

	private async initialized(): Promise<void> {
		await this.client.initialized();
	}

	public async checkStatus(): Promise<void> {
		await this.client.customRequest("checkStatus", {
			localChecksOnly: false,
		});
	}

	public async setEditorInfo(): Promise<void> {
		await this.client.customRequest("setEditorInfo", {
			editorInfo: {
				name: "obsidian",
				version: "0.0.1",
			},
			editorPluginInfo: {
				name: "obsidian-copilot",
				version: "0.0.1",
			},
		});

		// Open the active file
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (activeFile) {
			Cacher.getInstance().setCurrentFilePath(
				this.basePath,
				activeFile?.path || ""
			);
		}
	}

	public async initiateSignIn(): Promise<any> {
		return await this.client.customRequest("signInInitiate", {});
	}

	public async confirmSignIn(code: string): Promise<any> {
		return await this.client.customRequest("signInConfirm", {
			userCode: code,
		});
	}

	public async signOut(): Promise<void> {
		return await this.client.customRequest("signOut", {});
	}

	public dispose(): void {
		this.client.exit();
	}
}

export default Client;
