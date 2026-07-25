/**
 * useWasmValidator — React hook wrapping the WASM schema validator.
 *
 * Loads `schema_validator` (compiled from Rust via wasm-pack) once, then
 * exposes a `validate(data)` function that returns `{ valid, errors }`.
 *
 * The WASM module locates its `.wasm` binary via `import.meta.url`, so no
 * explicit URL needs to be passed. The schema is read from a ref at call
 * time, so updating the `schema` prop does not reload the WASM module.
 *
 * Public API matches the spec in the WASM validation skill (SKILL.md),
 * with an added `error` state for diagnostics.
 */

import { useEffect, useRef, useState } from 'react';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type ValidateFn = (data: unknown) => ValidationResult;

const NOT_LOADED: ValidateFn = () => ({ valid: false, errors: ['WASM not loaded'] });

export function useWasmValidator(schema: Record<string, unknown>) {
  const [validate, setValidate] = useState<ValidateFn>(() => NOT_LOADED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest schema in a ref so the WASM module only loads once
  // while `validate` always checks against the current schema.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('../wasm/schema_validator.js');
        // Instantiate the WASM module. `default` is wasm-bindgen's async
        // `init` — it resolves `schema_validator_bg.wasm` via import.meta.url.
        await mod.default();
        if (cancelled) return;

        setValidate(
          () =>
            (data: unknown): ValidationResult => {
              const dataJson = JSON.stringify(data);
              const schemaJson = JSON.stringify(schemaRef.current);
              const valid = mod.validate_schema(dataJson, schemaJson);
              if (valid) return { valid: true, errors: [] };
              try {
                const errors = JSON.parse(
                  mod.get_validation_errors(dataJson, schemaJson),
                ) as string[];
                return { valid: false, errors };
              } catch {
                return { valid: false, errors: ['Validation failed'] };
              }
            },
        );
        setLoading(false);
      } catch (err) {
        console.error('[useWasmValidator] Failed to load WASM:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { validate, loading, error };
}
