import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";

import CopilotPlugin from "../main";
import AuthModal from "../modal/AuthModal";
import Node from "../helpers/Node";
import Logger from "../helpers/Logger";
import File from "../helpers/File";
import Json from "../helpers/Json";
import Vault from "../helpers/Vault";
import { defaultModels } from "../copilot-chat/store/slices/message";

export interface SettingsObserver {
	onSettingsUpdate(): Promise<void>;
}

export type CopilotChatSettings = {
	deviceCode: string | null;
	pat: string | null; // Personal Access Token to create the access token
	// Access token to authenticate the user
	accessToken: {
		token: string | null;
		expiresAt: number | null;
	};
	selectedModel?: {
		label: string;
		value: string;
	};
};

export interface CopilotPluginSettings {
	nodePath: string;
	nodePathUpdatedToNode20: boolean;
	enabled: boolean;
	debug: boolean;
	deviceSpecificSettings: string[];
	useDeviceSpecificSettings: boolean;
	proxy: string;
	chatSettings?: CopilotChatSettings;
	systemPrompt: string;
	invertEnterSendBehavior: boolean;
}

export const DEFAULT_SETTINGS: CopilotPluginSettings = {
	nodePath: "default",
	nodePathUpdatedToNode20: false,
	enabled: true,
	debug: false,
	deviceSpecificSettings: ["nodePath"],
	useDeviceSpecificSettings: false,
	proxy: "",
	chatSettings: {
		deviceCode: null,
		pat: null,
		accessToken: {
			token: null,
			expiresAt: null,
		},
		selectedModel: defaultModels[4],
	},
	systemPrompt:
		"You are GitHub Copilot, an AI assistant. You are helping the user with their tasks in Obsidian.",
	invertEnterSendBehavior: false,
};

class CopilotPluginSettingTab extends PluginSettingTab {
	plugin: CopilotPlugin;
	private observers: SettingsObserver[] = [];

	constructor(app: App, plugin: CopilotPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h1", { text: "GitHub Copilot Settings" });

		new Setting(containerEl)
			.setName("Enable Copilot")
			.setDesc(
				"Enable or disable GitHub Copilot. This will also start the copilot server.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Node binary path")
			.setDesc(
				"The path to your node binary (at least Node v20). This is used to run the copilot server.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter the path to your node binary.")
					.setValue(this.plugin.settings.nodePath)
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.nodePath = value;
								await this.saveSettings();
							},
							1000,
							true,
						),
					),
			)
			.addButton((button) =>
				button
					.setButtonText("Test the path")
					.setTooltip(
						"This will test the path and verify the version of node.",
					)
					.onClick(async () => {
						const path = await Node.testNodePath(
							this.plugin.settings.nodePath,
						);
						if (path) {
							this.plugin.settings.nodePath = path;
							await this.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Use device-specific settings")
			.setDesc(
				"If enabled, certain settings (only the node path for now) will be saved to a separate file. This is useful when using the same vault on multiple devices. Default is false.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useDeviceSpecificSettings)
					.onChange(async (value) => {
						this.plugin.settings.useDeviceSpecificSettings = value;
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Setup proxy")
			.setDesc(
				"Set up a proxy for the copilot service. Should start with http:// or https://.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter the proxy URL.")
					.setValue(this.plugin.settings.proxy)
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.proxy = value;
								await this.saveSettings();
							},
							1000,
							true,
						),
					),
			);

		new Setting(containerEl)
			.setName("Enable debug mode")
			.setDesc(
				"Enable logging for debugging purposes. Logs are written to the console.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debug)
					.onChange(async (value) => {
						this.plugin.settings.debug = value;
						Logger.getInstance().setDebug(value);
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.addButton((button) =>
				button
					.setButtonText("Restart sign-in process")
					.setTooltip(
						"Note that this will start the copilot service in the background.",
					)
					.onClick(async () => {
						this.needCopilotAgentEnabled(async () => {
							this.initSignIn();
						});
					}),
			)
			.addButton((button) =>
				button
					.setButtonText("Sign out")
					.setTooltip(
						"Note that this will start the copilot service in the background.",
					)
					.setWarning()
					.onClick(async () => {
						this.needCopilotAgentEnabled(async () => {
							this.signOut();
						});
					}),
			);

		containerEl.createEl("h1", { text: "Copilot Chat Settings" });

		new Setting(containerEl)
			.setName("Invert Enter/Shift+Enter behavior")
			.setDesc(
				"When enabled, pressing Enter will create a new line and Shift+Enter will send the message. By default, Enter sends the message and Shift+Enter creates a new line.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.invertEnterSendBehavior)
					.onChange(async (value) => {
						this.plugin.settings.invertEnterSendBehavior = value;
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("System prompt")
			.setDesc(
				"Configure the system prompt used for new chat conversations.",
			)
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text.inputEl.cols = 50;
				return text
					.setPlaceholder("Enter a system prompt for Copilot Chat.")
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.systemPrompt = value;
								await this.saveSettings(false, true);
							},
							1000,
							true,
						),
					);
			});
	}

	public async loadSettings() {
		const defaultSettings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.plugin.loadData(),
		);
		if (defaultSettings.useDeviceSpecificSettings) {
			this.plugin.settings = Object.assign(
				{},
				defaultSettings,
				Json.textToJsonObject(
					File.readFileSync(
						Vault.getPluginPath(this.plugin.app) +
							"/device_data.json",
					),
				) || {},
			);
		} else {
			this.plugin.settings = defaultSettings;
		}
	}

	public async saveSettings(
		notify = true,
		notice = true,
	): Promise<void | void[]> {
		if (this.plugin.settings.useDeviceSpecificSettings) {
			File.writeFileSync(
				Vault.getPluginPath(this.plugin.app) + "/device_data.json",
				Json.jsonObjectToText(
					Json.onlyKeepProperties(
						this.plugin.settings,
						this.plugin.settings.deviceSpecificSettings,
					),
				),
			);
		}
		await this.plugin.saveData(this.plugin.settings);
		await this.loadSettings();
		if (notice) new Notice("Settings saved successfully.");
		if (notify) return this.notifyObservers();
		return Promise.resolve();
	}

	public isCopilotEnabled(): boolean {
		return (
			this.plugin.settings.enabled &&
			this.plugin.settings.nodePath !== "" &&
			this.plugin.settings.nodePath !== DEFAULT_SETTINGS.nodePath
		);
	}

	public async isCopilotEnabledWithPathCheck(): Promise<boolean> {
		return (
			this.isCopilotEnabled() &&
			(await Node.testNodePath(this.plugin.settings.nodePath, true).then(
				async (path) => {
					if (!path) return false;
					if (path) {
						this.plugin.settings.nodePathUpdatedToNode20 = true;
						await this.saveSettings(false, false);
					}
					return true;
				},
			))
		);
	}

	private async needCopilotAgentEnabled(callback: () => void) {
		if (!this.plugin.settings.enabled) {
			this.plugin.settings.enabled = true;
			await this.saveSettings(true, false).then(() => {
				callback();
			});
		} else {
			callback();
		}
	}

	private async initSignIn() {
		await this.plugin.copilotAgent
			.getClient()
			.initiateSignIn()
			.then((res) => {
				if (res.status === "AlreadySignedIn") {
					new Notice("You are already signed in.");
				} else {
					new AuthModal(
						this.plugin,
						res.userCode,
						res.verificationUri,
					).open();
				}
			});
	}

	private async signOut() {
		await this.plugin.copilotAgent
			.getClient()
			.signOut()
			.then(() => {
				new Notice("Signed out successfully.");
			});
	}

	public registerObserver(observer: SettingsObserver) {
		this.observers.push(observer);
	}

	private notifyObservers(): Promise<void[]> {
		return Promise.all(
			this.observers.map((observer) => observer.onSettingsUpdate()),
		);
	}
}

export default CopilotPluginSettingTab;
