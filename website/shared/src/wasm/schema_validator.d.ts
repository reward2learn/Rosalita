/* tslint:disable */
/* eslint-disable */

/**
 * Returns a JSON-encoded array of validation error strings for
 * `data` against `schema`. Returns `["<parse error>"]` if either
 * argument is not valid JSON.
 */
export function get_validation_errors(data_json: string, schema_json: string): string;

/**
 * Validates a single JSON-encoded value against a field type name
 * (e.g. "string", "integer", "decimal", "boolean", "enum", ...).
 * Note: enum membership cannot be checked without the schema's
 * `enumValues`, so for `enum` this only verifies the value is a string.
 */
export function validate_field(value_json: string, field_type: string): boolean;

/**
 * Validates JSON `data` against a `SchemaModel`-shaped JSON `schema`.
 * Returns `true` when there are no validation errors.
 */
export function validate_schema(data_json: string, schema_json: string): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly get_validation_errors: (a: number, b: number, c: number, d: number) => [number, number];
    readonly validate_field: (a: number, b: number, c: number, d: number) => number;
    readonly validate_schema: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
