import { type Build, encodeShareCode, type InexpressibleDifference, type NotImportedPart, type PositionalBuffPanel } from "@ro-ratorio-branch/core/platform-neutral";
import { type ChangeEvent, type DragEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { type Descriptions, noDescriptions, type SaveWritten } from "../engine-host/host-protocol.ts";
import { CopyIcon, DownloadIcon, ImportIcon, LinkIcon, OpenOutsideIcon, WarningIcon } from "./Icons.tsx";
import { slotLabels } from "./labels.ts";
import { RightsFooter } from "./RightsFooter.tsx";
import { type ExportScope, exportContentOf, exportScopes, kilobytesOf, shareLinkOf } from "./share-export-model.ts";
import {
    applyImport,
    type ImportMode,
    type ImportRecognition,
    type ImportRefusal,
    importModesFor,
    type RecognizedImport,
    recognizeImport,
} from "./share-import-model.ts";
import { engineHost, type TreeWorkspace } from "./use-tree-workspace.ts";
import { t } from "./text/ui-text.ts";
import { ImagePackCard } from "../image-pack/ImagePackCard.tsx";
import { type GistRead, gistIdOf, newGistPage, readGist } from "./gist.ts";

interface ShareScreenProps {
    readonly workspace: TreeWorkspace;
    readonly selectedNodeId: string | null;
    readonly isWide: boolean;
    /** Text to start the import with, for a page opened through a share link. */
    readonly initialImportText: string;
    onShowTree(): void;
}

/** Export and import: share codes, JSON backups and ratorio saves. One layout that stacks on a phone. */
export function ShareScreen({ workspace, selectedNodeId, isWide, initialImportText, onShowTree }: ShareScreenProps) {
    const [importText, setImportText] = useState(initialImportText);

    const panels = (
        <div className="share-columns">
            <div className="share-column">
                <ExportCard workspace={workspace} selectedNodeId={selectedNodeId} />
                <RatorioSaveCard workspace={workspace} selectedNodeId={selectedNodeId} />
                <BackupCard workspace={workspace} onFileRead={setImportText} />
            </div>
            <div className="share-column">
                <ImportCard workspace={workspace} importText={importText} onImportTextChange={setImportText} onShowTree={onShowTree} />
                <ImagePackCard />
            </div>
        </div>
    );

    if (isWide) {
        return (
            <main className="wide-main share-main">
                <div className="view-head">
                    <h1>{t("共有 · 読み込み")}</h1>
                </div>
                {panels}
            </main>
        );
    }
    return (
        <div className="screen">
            <header className="app-header">
                <h1 className="screen-title">{t("共有 · 読み込み")}</h1>
            </header>
            <div className="scroll">
                {panels}
                <RightsFooter />
            </div>
        </div>
    );
}

const scopeLabels: Readonly<Record<ExportScope, string>> = {
    rootOnly: t("ROOT のみ"),
    wholeTree: t("ツリー全体"),
    selectedNode: t("選択ノード"),
};

type ExportNotice = "codeCopied" | "linkCopied" | "copyRefused" | "codeCopiedForGist";

const exportNoticeTexts: Readonly<Record<ExportNotice, string>> = {
    codeCopied: t("コードをコピーしました"),
    linkCopied: t("リンクをコピーしました"),
    copyRefused: t("コピーできませんでした。コードを選択してコピーしてください"),
    codeCopiedForGist: t("コードをコピーしました。開いた Gist のページに貼り付けて保存し、その URL を共有してください"),
};

function ExportCard({ workspace, selectedNodeId }: { workspace: TreeWorkspace; selectedNodeId: string | null }) {
    const { tree } = workspace;
    const [scope, setScope] = useState<ExportScope>("wholeTree");
    const [shareCode, setShareCode] = useState<string | null>(null);
    const [notice, setNotice] = useState<ExportNotice | null>(null);

    const content = useMemo(() => exportContentOf(tree, scope, selectedNodeId), [tree, scope, selectedNodeId]);
    const selectedNodeLabel = tree.nodes.find((node) => node.id === selectedNodeId)?.label;

    useEffect(() => {
        let isLatest = true;
        setShareCode(null);
        setNotice(null);
        if (content !== null) {
            void encodeShareCode(content).then((encoded) => {
                if (isLatest) {
                    setShareCode(encoded);
                }
            });
        }
        return () => {
            isLatest = false;
        };
    }, [content]);

    async function copy(text: string, copiedNotice: ExportNotice) {
        try {
            await navigator.clipboard.writeText(text);
            setNotice(copiedNotice);
        } catch {
            setNotice("copyRefused");
        }
    }

    async function shareLink(code: string) {
        const link = shareLinkOf(window.location.href, code);
        if (typeof navigator.share !== "function") {
            await copy(link, "linkCopied");
            return;
        }
        try {
            await navigator.share({ url: link });
        } catch {
            // Closing the share sheet rejects too; there is nothing to report either way.
        }
    }

    const carried = scope === "wholeTree" ? `${tree.nodes.length} nodes` : scope === "rootOnly" ? "ROOT" : (selectedNodeLabel ?? "—");

    return (
        <section className="card share-card">
            <h2>
                {t("ビルドコード")} <small>Build code</small>
            </h2>
            <div className="seg" role="group" aria-label={t("範囲")}>
                {exportScopes.map((candidate) => (
                    <button key={candidate} type="button" aria-pressed={scope === candidate} onClick={() => setScope(candidate)}>
                        {scopeLabels[candidate]}
                    </button>
                ))}
            </div>
            <div className="mono code-box" data-testid="share-code">
                {content === null ? <span className="code-box-note">{t("ツリーでノードを選択してください（stale なノードは共有できません）")}</span> : (shareCode ?? "…")}
            </div>
            <div className="share-meta num">
                <span>
                    {carried}
                    {shareCode !== null && ` · ${kilobytesOf(shareCode).toFixed(1)} KB`}
                </span>
                <span>{t("コスト込み · v1")}</span>
            </div>
            <div className="button-pair">
                <button type="button" className="btn" disabled={shareCode === null} onClick={() => shareCode !== null && void copy(shareCode, "codeCopied")}>
                    <CopyIcon />
                    {t("コピー")}
                </button>
                <button type="button" className="btn btn-p" disabled={shareCode === null} onClick={() => shareCode !== null && void shareLink(shareCode)}>
                    <LinkIcon />
                    {t("リンクで共有")}
                </button>
            </div>
            {shareCode !== null && (
                <a className="btn gist-link" href={newGistPage} target="_blank" rel="noopener noreferrer" onClick={() => void copy(shareCode, "codeCopiedForGist")}>
                    {t("コピーして Gist を開く ↗")}
                </a>
            )}
            <div className="share-notice" role="status">
                {notice !== null && exportNoticeTexts[notice]}
            </div>
        </section>
    );
}

type SaveWriting = { readonly state: "writing" } | { readonly state: "written"; readonly written: SaveWritten } | { readonly state: "failed" };

/** One build of the open tree as a ratorio save URL: to check a number against the original, or to hand to someone who uses it. */
function RatorioSaveCard({ workspace, selectedNodeId }: { workspace: TreeWorkspace; selectedNodeId: string | null }) {
    const { tree } = workspace;
    const selectedNode = tree.nodes.find((node) => node.id === selectedNodeId);
    const [scope, setScope] = useState<"rootOnly" | "selectedNode">("rootOnly");
    const [writing, setWriting] = useState<SaveWriting>({ state: "writing" });
    const [isCopied, setIsCopied] = useState(false);

    const build = useMemo(() => exportContentOf(tree, scope, selectedNodeId) as Build | null, [tree, scope, selectedNodeId]);

    useEffect(() => {
        let isLatest = true;
        setWriting({ state: "writing" });
        setIsCopied(false);
        if (build !== null) {
            void engineHost()
                .then((host) => host.writeSave(build))
                .then((written): SaveWriting => ({ state: "written", written }))
                .catch((): SaveWriting => ({ state: "failed" }))
                .then((nextWriting) => {
                    if (isLatest) {
                        setWriting(nextWriting);
                    }
                });
        }
        return () => {
            isLatest = false;
        };
    }, [build]);

    const saveUrl = build !== null && writing.state === "written" ? writing.written.saveUrl : null;
    const notExportedCount = build !== null && writing.state === "written" ? writing.written.notExported.length : 0;

    return (
        <section className="card share-card">
            <h2>
                {t("ラトリオ URL")} <small>ratorio save</small>
            </h2>
            <p>{t("1 つのビルドを ROラトリオHUB のセーブ URL にします。ツリーとコストは含まれません。")}</p>
            <div className="seg" role="group" aria-label={t("書き出すビルド")}>
                <button type="button" aria-pressed={scope === "rootOnly"} onClick={() => setScope("rootOnly")}>
                    ROOT
                </button>
                <button type="button" aria-pressed={scope === "selectedNode"} onClick={() => setScope("selectedNode")}>
                    {t("選択ノード")}{selectedNode === undefined ? "" : ` · ${selectedNode.label}`}
                </button>
            </div>
            <div className="mono code-box" data-testid="ratorio-save-url">
                {build === null ? (
                    <span className="code-box-note">{t("ツリーでノードを選択してください（stale なノードは書き出せません）")}</span>
                ) : writing.state === "failed" ? (
                    <span className="code-box-note">{t("書き出せませんでした")}</span>
                ) : (
                    (saveUrl ?? "…")
                )}
            </div>
            {notExportedCount > 0 && <div className="piece-status barred">{t("ラトリオに渡せない項目が")} {notExportedCount} {t("件あります")}</div>}
            <div className="button-pair">
                <button
                    type="button"
                    className="btn"
                    disabled={saveUrl === null}
                    onClick={() => saveUrl !== null && void navigator.clipboard.writeText(saveUrl).then(() => setIsCopied(true), () => setIsCopied(false))}
                >
                    <CopyIcon />
                    {isCopied ? t("コピーしました") : t("コピー")}
                </button>
                {saveUrl === null ? (
                    <button type="button" className="btn" disabled>
                        <OpenOutsideIcon />
                        {t("ラトリオで開く")}
                    </button>
                ) : (
                    <a className="btn" href={saveUrl} target="_blank" rel="noreferrer">
                        <OpenOutsideIcon />
                        {t("ラトリオで開く")}
                    </a>
                )}
            </div>
        </section>
    );
}

function backupFileName(): string {
    return `ro-ratorio-branch-${new Date().toISOString().slice(0, 10)}.json`;
}

function saveAsJsonFile(fileName: string, content: unknown) {
    const fileUrl = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(fileUrl);
}

function BackupCard({ workspace, onFileRead }: { workspace: TreeWorkspace; onFileRead(fileText: string): void }) {
    const filePicker = useRef<HTMLInputElement>(null);

    async function readPickedFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file !== undefined) {
            onFileRead(await file.text());
        }
    }

    return (
        <section className="card share-card">
            <h2>
                {t("JSON バックアップ")} <small>Backup</small>
            </h2>
            <p>{t("すべてのキャラ、ツリー、ロッカー、コストを 1 つのファイルに保存します。ビルドコードは 1 つのツリーかビルドだけを運びます。")}</p>
            <div className="button-pair">
                <button type="button" className="btn" onClick={() => filePicker.current?.click()}>
                    <ImportIcon />
                    {t("JSON 読込")}
                </button>
                <button type="button" className="btn" onClick={() => saveAsJsonFile(backupFileName(), workspace.workspace)}>
                    <DownloadIcon />
                    {t("JSON 保存")}
                </button>
            </div>
            <input ref={filePicker} type="file" accept="application/json,.json" hidden onChange={(event) => void readPickedFile(event)} />
        </section>
    );
}

const recognitionDelayInMilliseconds = 250;

const gistFailureTexts: Readonly<Record<Extract<GistRead, { state: "failed" }>["reason"], string>> = {
    notFound: t("その Gist は見つかりません。非公開の Gist は読み込めません。"),
    rateLimited: t("GitHub の読み込み回数の上限に達しました。しばらくしてからもう一度お試しください。"),
    empty: t("その Gist にはテキストがありません。"),
    unreachable: t("GitHub に接続できませんでした。"),
};

type ImportReading =
    | { readonly state: "idle" }
    | { readonly state: "reading" }
    | { readonly state: "read"; readonly recognition: ImportRecognition }
    | { readonly state: "engineFailed" }
    | { readonly state: "gistFailed"; readonly reason: Extract<GistRead, { state: "failed" }>["reason"] };

interface FinishedImport {
    readonly mode: ImportMode;
    readonly inexpressible: readonly InexpressibleDifference[];
}

interface ImportCardProps {
    readonly workspace: TreeWorkspace;
    readonly importText: string;
    onImportTextChange(text: string): void;
    onShowTree(): void;
}

function ImportCard({ workspace, importText, onImportTextChange, onShowTree }: ImportCardProps) {
    const [reading, setReading] = useState<ImportReading>({ state: "idle" });
    const [mode, setMode] = useState<ImportMode>("addAsNew");
    const [name, setName] = useState("");
    const [finishedImport, setFinishedImport] = useState<FinishedImport | null>(null);
    const [descriptions, setDescriptions] = useState<Descriptions>(noDescriptions);
    const textFieldId = useId();

    useEffect(() => {
        if (importText.trim() === "") {
            setReading({ state: "idle" });
            return;
        }
        let isLatest = true;
        setReading({ state: "reading" });
        const timer = window.setTimeout(() => {
            // The address of a gist stands for what the gist holds: its text takes the address's place and is read in turn.
            const gistId = gistIdOf(importText);
            if (gistId !== null) {
                void readGist(gistId).then((gistRead) => {
                    if (!isLatest) {
                        return;
                    }
                    if (gistRead.state === "read") {
                        onImportTextChange(gistRead.text);
                    } else {
                        setReading({ state: "gistFailed", reason: gistRead.reason });
                    }
                });
                return;
            }
            void recognizeImport(importText, async (saveUrlOrData) => (await engineHost()).readSave(saveUrlOrData))
                .then((recognition): ImportReading => ({ state: "read", recognition }))
                .catch((): ImportReading => ({ state: "engineFailed" }))
                .then((nextReading) => {
                    if (isLatest) {
                        setReading(nextReading);
                    }
                });
        }, recognitionDelayInMilliseconds);
        return () => {
            isLatest = false;
            window.clearTimeout(timer);
        };
    }, [importText, onImportTextChange]);

    const recognized = reading.state === "read" && "recognized" in reading.recognition ? reading.recognition.recognized : null;
    const refusal = reading.state === "read" && "refused" in reading.recognition ? reading.recognition.refused : null;
    const modes = recognized === null ? [] : importModesFor(recognized);

    useEffect(() => {
        if (recognized === null) {
            return;
        }
        setMode(importModesFor(recognized)[0] ?? "addAsNew");
        setFinishedImport(null);
        const shown = shownCharacterAndScenarioOf(recognized);
        if (shown === null) {
            return;
        }
        let isLatest = true;
        void engineHost()
            .then((host) =>
                host.describe({
                    jobIds: [shown.jobId],
                    skillIds: shown.scenario === null ? [] : [shown.scenario.skillId],
                    monsterIds: shown.scenario === null ? [] : [shown.scenario.targetMonsterId],
                    itemIds: [],
                    cardOrEnchantIds: [],
                }),
            )
            .then((described) => {
                if (isLatest) {
                    setDescriptions(described);
                }
            })
            .catch(() => undefined);
        return () => {
            isLatest = false;
        };
    }, [recognized]);

    function readDroppedFile(event: DragEvent<HTMLTextAreaElement>) {
        const file = event.dataTransfer.files[0];
        if (file === undefined) {
            return;
        }
        event.preventDefault();
        void file.text().then(onImportTextChange);
    }

    function applyRecognized(recognizedImport: RecognizedImport) {
        if (mode === "replaceEverything") {
            saveAsJsonFile(backupFileName(), workspace.workspace);
        }
        const fallbackName = recognizedImport.kind === "tree" ? t("読み込んだツリー") : t("読み込んだビルド");
        const applied = applyImport(workspace.workspace, workspace.activeTreeId, recognizedImport, mode, name.trim() || fallbackName);
        workspace.takeWorkspace(applied.workspace, applied.activeTreeId);
        setFinishedImport({ mode, inexpressible: applied.inexpressible });
        setName("");
        onImportTextChange("");
    }

    return (
        <section className="card share-card">
            <h2>
                {t("読み込み")} <small>Import</small>
            </h2>
            <label htmlFor={textFieldId} className="field-label">
                {t("ラトリオ URL · ビルドコード · JSON · Gist の URL を貼り付け、またはファイルをドロップ")}
            </label>
            <textarea
                id={textFieldId}
                className={`mono import-text${refusal !== null && refusal.kind !== "empty" ? " refused" : ""}`}
                value={importText}
                spellCheck={false}
                onChange={(event) => onImportTextChange(event.target.value)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={readDroppedFile}
            />

            {reading.state === "reading" && <p role="status">{t("確認中…")}</p>}
            {reading.state === "engineFailed" && (
                <div className="import-refusal" role="alert">
                    <div className="import-refusal-title">
                        <WarningIcon size={16} />
                        {t("計算エンジンを起動できませんでした")}
                    </div>
                </div>
            )}
            {reading.state === "gistFailed" && (
                <div className="import-refusal" role="alert" data-refusal="gist">
                    <div className="import-refusal-title">
                        <WarningIcon size={16} />
                        {t("Gist を読み込めませんでした")}
                    </div>
                    <div>{gistFailureTexts[reading.reason]}</div>
                </div>
            )}
            {refusal !== null && refusal.kind !== "empty" && (
                <div className="import-refusal" role="alert" data-refusal={refusal.kind}>
                    <div className="import-refusal-title">
                        <WarningIcon size={16} />
                        {t("読み込めませんでした")}
                    </div>
                    <div>{refusalText(refusal)}</div>
                </div>
            )}

            {recognized !== null && (
                <>
                    <ImportPreview recognized={recognized} descriptions={descriptions} />
                    <div className="import-options" role="radiogroup" aria-label={t("読み込み方法")}>
                        {modes.map((candidate) => (
                            <label key={candidate} className="opt">
                                <input type="radio" name={`${textFieldId}-mode`} checked={mode === candidate} onChange={() => setMode(candidate)} />
                                <span>
                                    {modeLabel(candidate, recognized)}
                                    <small>{modeHints[candidate]}</small>
                                </span>
                            </label>
                        ))}
                    </div>
                    {recognized.kind !== "workspace" && (
                        <label className="field-label">
                            {t("名前")}
                            <input
                                className="text-field"
                                value={name}
                                placeholder={recognized.kind === "tree" ? t("読み込んだツリー") : t("読み込んだビルド")}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </label>
                    )}
                    <div className="import-actions">
                        <button type="button" className="btn" onClick={() => onImportTextChange("")}>
                            {t("キャンセル")}
                        </button>
                        <button type="button" className="btn btn-p" onClick={() => applyRecognized(recognized)}>
                            {mode === "replaceEverything" ? t("バックアップして置き換え") : t("読み込む")}
                        </button>
                    </div>
                </>
            )}

            {finishedImport !== null && recognized === null && (
                <div className="import-preview" role="status" data-testid="import-finished">
                    <div className="import-preview-title">{t("読み込みました")}</div>
                    {finishedImport.inexpressible.length > 0 && (
                        <div>
                            {t("分岐では表せない違いがあります:")}{" "}
                            {finishedImport.inexpressible.map((difference) => inexpressibleLabels[difference]).join("、")}
                        </div>
                    )}
                    <div>
                        <button type="button" className="btn" onClick={onShowTree}>
                            {t("ツリーを見る")}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}

function shownCharacterAndScenarioOf(recognized: RecognizedImport) {
    if (recognized.kind === "tree") {
        return { jobId: recognized.tree.root.jobId, baseLevel: recognized.tree.root.baseLevel, scenario: recognized.tree.scenario };
    }
    if (recognized.kind === "character") {
        return { jobId: recognized.character.jobId, baseLevel: recognized.character.baseLevel, scenario: recognized.scenario };
    }
    return null;
}

const sourceLabels: Readonly<Record<RecognizedImport["source"], string>> = {
    shareCode: t("ビルドコード v1"),
    json: "JSON",
    ratorioSave: t("ラトリオ URL"),
};

function ImportPreview({ recognized, descriptions }: { recognized: RecognizedImport; descriptions: Descriptions }) {
    const shown = shownCharacterAndScenarioOf(recognized);
    const notImported = recognized.kind === "character" ? recognized.notImported : [];

    return (
        <div className="import-preview" data-testid="import-preview" data-kind={recognized.kind}>
            <div className="import-preview-title">{t("読み込めます ·")} {sourceLabels[recognized.source]}</div>
            <dl className="import-facts num">
                {recognized.kind === "workspace" ? (
                    <>
                        <dt>{t("キャラ")}</dt>
                        <dd>{Object.keys(recognized.workspace.characters).length}</dd>
                        <dt>{t("ツリー")}</dt>
                        <dd>{Object.keys(recognized.workspace.trees).length}</dd>
                        <dt>{t("ロッカー")}</dt>
                        <dd>{Object.keys(recognized.workspace.gearPieces).length} {t("ギア")}</dd>
                    </>
                ) : (
                    shown !== null && (
                        <>
                            <dt>{t("キャラ")}</dt>
                            <dd>
                                {descriptions.jobNames[shown.jobId] ?? `job #${shown.jobId}`} Lv{shown.baseLevel}
                            </dd>
                            <dt>{t("ツリー")}</dt>
                            <dd>{recognized.kind === "tree" ? t("{0} ノード", recognized.tree.nodes.length) : t("なし（ビルドのみ）")}</dd>
                            <dt>{t("シナリオ")}</dt>
                            <dd>
                                {shown.scenario === null
                                    ? t("なし（攻撃スキルと対象は含まれていません）")
                                    : `${descriptions.skillNames[shown.scenario.skillId] ?? `skill #${shown.scenario.skillId}`} → ${
                                          descriptions.monsterNames[shown.scenario.targetMonsterId] ?? `monster #${shown.scenario.targetMonsterId}`
                                      }`}
                            </dd>
                        </>
                    )
                )}
            </dl>
            {notImported.length > 0 && (
                <details className="not-imported">
                    <summary>{t("読み込めない項目")} {notImported.length} {t("件")}</summary>
                    <ul>
                        {notImported.map((part, partIndex) => (
                            <li key={partIndex}>{notImportedText(part)}</li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}

function notImportedText(part: NotImportedPart): string {
    switch (part.kind) {
        case "upstreamSection":
            return part.section;
        case "supportBuffWithoutName":
            return t("支援 {0} #{1}", part.section, part.position);
        case "skillWithoutSlot":
            return `${part.list === "learnedSkills" ? t("習得スキル") : t("自己支援")} #${part.position}`;
        case "panelBuffWithoutDefinition":
            return `${buffPanelLabels[part.panel]} #${part.position}`;
        case "customizationWithoutName":
            return t("性能カスタマイズ {0} #{1}", part.section, part.position);
        case "targetSettingWithoutName":
            return t("モンスター設定 {0} #{1}", part.section, part.position);
    }
}

function modeLabel(mode: ImportMode, recognized: RecognizedImport): string {
    if (mode === "addAsNew") {
        return recognized.kind === "tree" ? t("新しいツリーとして追加") : t("新しいキャラとして追加");
    }
    return mode === "addAsBranch" ? t("現在のツリーに子ノードとして追加") : t("すべて置き換え");
}

const modeHints: Readonly<Record<ImportMode, string>> = {
    addAsNew: t("今のツリーとロッカーはそのまま残ります"),
    addAsBranch: t("ROOT のビルドだけを使い、現在の装備との差分を 1 つの分岐にします"),
    replaceEverything: t("先に今のデータを JSON バックアップとして保存します"),
};

const inexpressibleLabels: Readonly<Record<InexpressibleDifference, string>> = {
    jobId: t("職業"),
    baseLevel: "Base Lv",
    jobLevel: "Job Lv",
    costumeId: t("衣装"),
};

const buffPanelLabels: Readonly<Record<PositionalBuffPanel, string>> = {
    guildBuffs: t("ギルド · ゴスペル"),
    itemBuffs: t("食品 · 消耗品"),
    otherBuffs: t("その他の支援 · 設定"),
};

function refusalText(refusal: Exclude<ImportRefusal, { kind: "empty" }>): string {
    switch (refusal.kind) {
        case "notRecognized":
            return t("ラトリオ URL、ビルドコード、JSON のどれでもありません。URL が途中で切れていないか確認してください。");
        case "invalidShareCode":
            return t("ビルドコードが壊れているか、途中で切れています。もう一度コピーしてください。");
        case "unreadableSave":
            return t("ラトリオのセーブデータですが、キャラクター情報が入っていません。");
        case "invalidContent":
            return t("{0}の形式に合わない箇所が {1} 件あります。", { build: t("ビルド"), tree: t("ツリー"), workspace: t("バックアップ") }[refusal.what], refusal.issueCount);
    }
}
