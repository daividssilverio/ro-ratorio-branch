// The entry point for Node: everything, plus an engine loader that supplies the browser globals itself.
export { loadRatorioEngine } from "./engine-adapter/load-ratorio-engine-in-node.ts";
export * from "./platform-neutral.ts";
export { loadNameSearch, type NameSearch, type NameSearchOptions, type NameSearchResult } from "./text/name-search.ts";
export { loadEffectWords } from "./text/effect-words.ts";
