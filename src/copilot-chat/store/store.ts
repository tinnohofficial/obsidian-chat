import { create } from "zustand";
import { StateCreator } from "zustand";
import { AuthSlice, createAuthSlice } from "./slices/auth";
import { MessageSlice, createMessageSlice } from "./slices/message";
import {
	ConversationSlice,
	createConversationSlice,
} from "./slices/conversation";

// Add interface for folder selection state
interface FolderSelectionSlice {
	selectedFolder: string;
	setSelectedFolder: (folder: string) => void;
}

type StoreState = AuthSlice & MessageSlice & ConversationSlice & FolderSelectionSlice;

type BoundStateCreator<T> = StateCreator<StoreState, [], [], T>;

const boundAuthSlice: BoundStateCreator<AuthSlice> = (...a) => ({
	...createAuthSlice(...a),
});

const boundMessageSlice: BoundStateCreator<MessageSlice> = (...a) => ({
	...createMessageSlice(...a),
});

const boundConversationSlice: BoundStateCreator<ConversationSlice> = (
	...a
) => ({
	...createConversationSlice(...a),
});

// Create folder selection slice
const boundFolderSelectionSlice: BoundStateCreator<FolderSelectionSlice> = (...a) => ({
	selectedFolder: "/", // Default to root folder (all vault)
	setSelectedFolder: (folder: string) => a[0]({ selectedFolder: folder }),
});

export const useCopilotStore = create<StoreState>()((...a) => ({
	...boundAuthSlice(...a),
	...boundMessageSlice(...a),
	...boundConversationSlice(...a),
	...boundFolderSelectionSlice(...a),
}));

export const useAuthStore = useCopilotStore;
