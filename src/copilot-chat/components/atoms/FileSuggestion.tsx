import React, { useEffect, useRef, useState } from "react";
import { concat, cx } from "../../../utils/style";
import CopilotPlugin from "../../../main";
import { TFile } from "obsidian";

const BASE_CLASSNAME = "copilot-chat-file-suggestion";

interface FileSuggestionProps {
	query: string;
	position: { top: number; left: number }; // Kept for compatibility
	onSelect: (file: { path: string; filename: string }) => void;
	onClose: () => void;
	plugin: CopilotPlugin | undefined;
	folderPath?: string;
}

const FileSuggestion: React.FC<FileSuggestionProps> = ({
	query,
	onSelect,
	onClose,
	plugin,
	folderPath = "/", 
}) => {
	const [files, setFiles] = useState<TFile[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!plugin) return;

		const markdownFiles = plugin.app.vault.getMarkdownFiles();

		// Filter files by folder path if not at root
		const folderFiltered = folderPath === "/" 
			? markdownFiles 
			: markdownFiles.filter(file => 
				file.path.startsWith(folderPath + "/") || 
				file.path === folderPath
			);

		// Then filter by search query
		const queryFiltered = folderFiltered.filter(
			(file) =>
				file.path.toLowerCase().includes(query.toLowerCase()) ||
				file.basename.toLowerCase().includes(query.toLowerCase()),
		);

		setFiles(queryFiltered);
		setSelectedIndex(0);
	}, [plugin, query, folderPath]);

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (files.length > 0) {
				setSelectedIndex((prev) => (prev + 1) % files.length);
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (files.length > 0) {
				setSelectedIndex(
					(prev) => (prev - 1 + files.length) % files.length,
				);
			}
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (files.length > 0 && files[selectedIndex]) {
				handleSelect(files[selectedIndex]);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			onClose();
		}
	};

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);

		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [files, selectedIndex]);

	const handleSelect = (file: TFile) => {
		onSelect({
			path: file.path,
			filename: file.basename,
		});
	};

	const getDirectory = (path: string) => {
		const lastSlashIndex = path.lastIndexOf("/");
		if (lastSlashIndex === -1) return "";
		return path.substring(0, lastSlashIndex);
	};

	return (
		<div
			className={concat(BASE_CLASSNAME, "container")}
			ref={containerRef}
		>
			{files.length === 0 ? (
				<div className={concat(BASE_CLASSNAME, "no-results")}>
					No files found {folderPath !== "/" ? `in ${folderPath}` : ""}
				</div>
			) : (
				<div className={concat(BASE_CLASSNAME, "list")}>
					{files.map((file, index) => (
						<div
							key={file.path}
							className={cx(
								concat(BASE_CLASSNAME, "item"),
								index === selectedIndex
									? concat(BASE_CLASSNAME, "item-selected")
									: "",
							)}
							onClick={() => handleSelect(file)}
						>
							<div className={concat(BASE_CLASSNAME, "item-filename")}>
								{file.basename}
							</div>
							{getDirectory(file.path) && (
								<div className={concat(BASE_CLASSNAME, "item-path")}>
									{getDirectory(file.path)}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default FileSuggestion;
