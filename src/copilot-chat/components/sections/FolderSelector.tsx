import React, { useState, useEffect, useRef } from "react";
import { concat, cx } from "../../../utils/style";
import { usePlugin } from "../../hooks/usePlugin";
import { TFolder } from "obsidian";
import { useCopilotStore } from "../../store/store";

const BASE_CLASSNAME = "copilot-chat-folder-selector";

const FolderSelector: React.FC = () => {
    const plugin = usePlugin();
    const { selectedFolder, setSelectedFolder } = useCopilotStore();
    const [isOpen, setIsOpen] = useState(false);
    const [folders, setFolders] = useState<TFolder[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!plugin) return;
        
        // Get all folders in the vault
        const rootFolder = plugin.app.vault.getRoot();
        const allFolders: TFolder[] = [rootFolder];
        
        const getAllFolders = (folder: TFolder) => {
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    allFolders.push(child);
                    getAllFolders(child);
                }
            }
        };
        
        getAllFolders(rootFolder);
        
        // Sort folders by path for better organization
        allFolders.sort((a, b) => a.path.localeCompare(b.path));
        
        setFolders(allFolders);
    }, [plugin]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleFolderSelect = (folder: TFolder) => {
        setSelectedFolder(folder.path);
        setIsOpen(false);
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    // Format path to show better hierarchy
    const formatFolderPath = (path: string): string => {
        if (path === "/") return "Root";
        
        // Split by slashes and use indentation to indicate nesting level
        const parts = path.split("/");
        const depth = parts.length - 1;
        const folderName = parts[parts.length - 1];
        
        return `${"\u00A0".repeat(depth * 2)}${folderName}`;
    };

    const displayName = selectedFolder === "/" ? "All Vault" : selectedFolder.split("/").pop() || "All Vault";

    return (
        <div className={concat(BASE_CLASSNAME, "container")} ref={dropdownRef}>
            <button
                className={concat(BASE_CLASSNAME, "button")}
                onClick={toggleDropdown}
                aria-label="Select folder scope"
            >
                <span className={concat(BASE_CLASSNAME, "label")}>
                    {displayName}
                </span>
                <span className={concat(BASE_CLASSNAME, "icon")}>
                    {isOpen ? "▲" : "▼"}
                </span>
            </button>
            
            {isOpen && (
                <div className={concat(BASE_CLASSNAME, "dropdown")}>
                    <div
                        className={cx(
                            concat(BASE_CLASSNAME, "item"),
                            selectedFolder === "/" ? concat(BASE_CLASSNAME, "item-selected") : ""
                        )}
                        onClick={() => handleFolderSelect({ path: "/" } as TFolder)}
                    >
                        All Vault
                    </div>
                    {folders.map((folder) => (
                        <div
                            key={folder.path}
                            className={cx(
                                concat(BASE_CLASSNAME, "item"),
                                selectedFolder === folder.path ? concat(BASE_CLASSNAME, "item-selected") : ""
                            )}
                            onClick={() => handleFolderSelect(folder)}
                            title={folder.path}
                        >
                            {formatFolderPath(folder.path)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FolderSelector;