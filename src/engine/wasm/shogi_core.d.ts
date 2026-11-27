/* tslint:disable */
/* eslint-disable */

export function wasm_analyze_multipv_json(sfen_str: string, moves_json: string, max_depth: number, max_nodes: number, multi_pv: number): string;

export function wasm_evaluate_sfen(sfen_str: string): number;

export function wasm_generate_legal_moves_json(sfen_str: string): string;

export function wasm_material_balance_json(sfen_str: string): string;

export function wasm_parse_sfen_json(sfen_str: string): string;

export function wasm_review_game_json(initial_sfen: string, moves_json: string, max_depth: number, max_nodes_per_ply: number): string;

export function wasm_search_best_move_json(sfen_str: string, max_depth: number, max_nodes: number): string;

export function wasm_to_sfen(pos_json: string, include_move_number: boolean): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly wasm_analyze_multipv_json: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly wasm_evaluate_sfen: (a: number, b: number) => [number, number, number];
    readonly wasm_generate_legal_moves_json: (a: number, b: number) => [number, number, number, number];
    readonly wasm_material_balance_json: (a: number, b: number) => [number, number, number, number];
    readonly wasm_parse_sfen_json: (a: number, b: number) => [number, number, number, number];
    readonly wasm_review_game_json: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly wasm_search_best_move_json: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasm_to_sfen: (a: number, b: number, c: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
