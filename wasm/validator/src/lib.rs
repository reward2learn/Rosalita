//! WASM Schema Validation Engine
//!
//! High-performance schema validation compiled from Rust to WebAssembly.
//! Validates JSON data against W3C-aligned schema definitions (see
//! `packages/shared/src/lib/schema/types.ts`).
//!
//! Exported via `wasm-bindgen`:
//! - `validate_schema(data_json, schema_json) -> bool`
//! - `validate_field(value_json, field_type) -> bool`
//! - `get_validation_errors(data_json, schema_json) -> String` (JSON array)

use wasm_bindgen::prelude::*;
use serde_json::Value;

// ── Helpers ──────────────────────────────────────────────

fn type_name(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

/// Returns `true` when the field value should be treated as "present".
/// Absent keys, `null`, and empty strings are considered NOT present
/// (matching `dynamic-form.tsx` semantics).
fn is_present(value: Option<&Value>) -> bool {
    match value {
        None => false,
        Some(Value::Null) => false,
        Some(Value::String(s)) if s.is_empty() => false,
        Some(_) => true,
    }
}

// ── Type + Constraint Checking ───────────────────────────

/// Checks a single value against a field type and (optionally) the
/// constraint fields read from `field`:
///   - `enumValues`: allowed values for `enum`
///   - `minLength` / `maxLength`: string length bounds
///   - `min` / `max`: numeric range bounds
fn check_type(value: &Value, field_type: &str, field: &Value) -> Result<(), String> {
    match field_type {
        "string" | "text" => {
            if !value.is_string() {
                return Err(format!("expected {} but got {}", field_type, type_name(value)));
            }
        }
        "integer" => {
            let is_int = value.is_i64()
                || value.is_u64()
                || value.as_f64().map(|n| n.fract() == 0.0).unwrap_or(false);
            if !is_int {
                return Err(format!("expected integer but got {}", type_name(value)));
            }
        }
        "decimal" => {
            if !value.is_number() {
                return Err(format!("expected decimal but got {}", type_name(value)));
            }
        }
        "boolean" => {
            if !value.is_boolean() {
                return Err(format!("expected boolean but got {}", type_name(value)));
            }
        }
        "datetime" | "date" | "time" => {
            if !value.is_string() {
                return Err(format!("expected {} string but got {}", field_type, type_name(value)));
            }
        }
        "enum" => {
            let s = match value.as_str() {
                Some(s) => s,
                None => {
                    return Err(format!("expected enum string but got {}", type_name(value)))
                }
            };
            let allowed = field.get("enumValues").and_then(|v| v.as_array());
            let ok = allowed
                .map(|a| a.iter().any(|x| x.as_str() == Some(s)))
                .unwrap_or(false);
            if !ok {
                return Err(format!("value '{}' is not in allowed enum values", s));
            }
        }
        "json" => {
            // xs:anyType — any JSON value is valid
        }
        "relation" => {
            if !value.is_string() {
                return Err(format!("expected relation id string but got {}", type_name(value)));
            }
        }
        other => {
            return Err(format!("unknown field type: {}", other));
        }
    }

    // ── String length constraints ────────────────────────
    if let Some(s) = value.as_str() {
        if let Some(min) = field.get("minLength").and_then(|v| v.as_u64()) {
            if (s.len() as u64) < min {
                return Err(format!("string length {} is less than minLength {}", s.len(), min));
            }
        }
        if let Some(max) = field.get("maxLength").and_then(|v| v.as_u64()) {
            if (s.len() as u64) > max {
                return Err(format!("string length {} exceeds maxLength {}", s.len(), max));
            }
        }
    }

    // ── Numeric range constraints ────────────────────────
    if let Some(n) = value.as_f64() {
        if let Some(min) = field.get("min").and_then(|v| v.as_f64()) {
            if n < min {
                return Err(format!("value {} is less than min {}", n, min));
            }
        }
        if let Some(max) = field.get("max").and_then(|v| v.as_f64()) {
            if n > max {
                return Err(format!("value {} exceeds max {}", n, max));
            }
        }
    }

    Ok(())
}

// ── Core Validation Routine ──────────────────────────────

/// Runs validation of `data` (a JSON object) against `schema` (a
/// `SchemaModel`-shaped JSON object with a `fields` array).
/// Returns the list of human-readable error strings.
fn run_validation(data: &Value, schema: &Value) -> Vec<String> {
    let mut errors: Vec<String> = Vec::new();

    let data_obj = match data.as_object() {
        Some(o) => o,
        None => {
            errors.push("data must be a JSON object".to_string());
            return errors;
        }
    };

    let fields = match schema.get("fields").and_then(|v| v.as_array()) {
        Some(f) => f,
        None => {
            errors.push("schema has no 'fields' array".to_string());
            return errors;
        }
    };

    for field in fields {
        let name = match field.get("name").and_then(|v| v.as_str()) {
            Some(n) => n,
            None => {
                errors.push("a field is missing its 'name'".to_string());
                continue;
            }
        };
        let field_type = field.get("type").and_then(|v| v.as_str()).unwrap_or("string");
        let required = field.get("required").and_then(|v| v.as_bool()).unwrap_or(false);

        let value_opt = data_obj.get(name);
        if !is_present(value_opt) {
            if required {
                errors.push(format!("field '{}' is required", name));
            }
            continue;
        }

        let value = value_opt.unwrap();
        if let Err(e) = check_type(value, field_type, field) {
            errors.push(format!("field '{}': {}", name, e));
        }
    }

    errors
}

// ── wasm-bindgen Exports ──────────────────────────────────

/// Validates JSON `data` against a `SchemaModel`-shaped JSON `schema`.
/// Returns `true` when there are no validation errors.
#[wasm_bindgen]
pub fn validate_schema(data_json: &str, schema_json: &str) -> bool {
    let data = match serde_json::from_str::<Value>(data_json) {
        Ok(v) => v,
        Err(_) => return false,
    };
    let schema = match serde_json::from_str::<Value>(schema_json) {
        Ok(v) => v,
        Err(_) => return false,
    };
    run_validation(&data, &schema).is_empty()
}

/// Validates a single JSON-encoded value against a field type name
/// (e.g. "string", "integer", "decimal", "boolean", "enum", ...).
/// Note: enum membership cannot be checked without the schema's
/// `enumValues`, so for `enum` this only verifies the value is a string.
#[wasm_bindgen]
pub fn validate_field(value_json: &str, field_type: &str) -> bool {
    let value = match serde_json::from_str::<Value>(value_json) {
        Ok(v) => v,
        Err(_) => return false,
    };
    if field_type == "enum" {
        return value.is_string();
    }
    // No constraint fields available for a standalone field check.
    check_type(&value, field_type, &Value::Null).is_ok()
}

/// Returns a JSON-encoded array of validation error strings for
/// `data` against `schema`. Returns `["<parse error>"]` if either
/// argument is not valid JSON.
#[wasm_bindgen]
pub fn get_validation_errors(data_json: &str, schema_json: &str) -> String {
    let data = match serde_json::from_str::<Value>(data_json) {
        Ok(v) => v,
        Err(e) => {
            return format!("[\"data JSON parse error: {}\"]", e);
        }
    };
    let schema = match serde_json::from_str::<Value>(schema_json) {
        Ok(v) => v,
        Err(e) => {
            return format!("[\"schema JSON parse error: {}\"]", e);
        }
    };
    let errors = run_validation(&data, &schema);
    serde_json::to_string(&errors).unwrap_or_else(|_| "[]".to_string())
}
