// Flexible serde deserializers for fields whose wire format may vary.
//
// The mobile/web client sometimes sends timestamps as ISO-8601 strings,
// sometimes as epoch-millis integers, and sometimes as epoch-seconds integers.
// Boolean fields may arrive as JSON booleans or as integers (0/1).
// JSON-text columns (`additional_data`, `metadata`) may arrive as actual
// objects rather than pre-serialized strings.
//
// Each deserializer is liberal in what it accepts and conservative in what it
// outputs — it coerces the input to the canonical Rust type used downstream.

use serde::{Deserialize, Deserializer};

// ============================================================================
// stringify_json — any JSON value → String
// ============================================================================

/// Accepts a JSON string *or* any other JSON value and returns a `String`.
/// Strings pass through; everything else is serialized to a JSON string
/// (e.g. the object `{}` becomes the string `"{}"`).
pub fn stringify_json<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let val = serde_json::Value::deserialize(deserializer)?;
    match val {
        serde_json::Value::String(s) => Ok(s),
        other => Ok(other.to_string()),
    }
}

// ============================================================================
// flexible_timestamp — i64 millis from various inputs
// ============================================================================

/// Parses a timestamp into **epoch milliseconds** from any of:
///
/// - `i64` / `u64` / `f64` — if the value looks like seconds (< 10 billion)
///   it is promoted to milliseconds; otherwise taken as-is.
/// - ISO-8601 string (`"2026-03-01T22:34:25.362Z"`) — parsed via chrono.
/// - Numeric string (`"1740000000000"`) — parsed as a number, then the
///   seconds-vs-millis heuristic is applied.
pub fn flexible_timestamp<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    let val = serde_json::Value::deserialize(deserializer)?;
    value_to_epoch_millis(&val).map_err(serde::de::Error::custom)
}

/// Like `flexible_timestamp` but for `Option<i64>` fields.
/// JSON `null` or missing values produce `None`.
pub fn flexible_opt_timestamp<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    let val = serde_json::Value::deserialize(deserializer)?;
    if val.is_null() {
        return Ok(None);
    }
    value_to_epoch_millis(&val)
        .map(Some)
        .map_err(serde::de::Error::custom)
}

/// Threshold below which a numeric timestamp is assumed to be in seconds.
/// 10 billion seconds ≈ year 2286 — any real millis timestamp for dates
/// after 1970 will be above this.
const SECONDS_VS_MILLIS_THRESHOLD: i64 = 10_000_000_000;

/// Core conversion logic, shared by the public deserializers.
fn value_to_epoch_millis(val: &serde_json::Value) -> Result<i64, String> {
    match val {
        serde_json::Value::Number(n) => {
            let raw = if let Some(i) = n.as_i64() {
                i
            } else if let Some(u) = n.as_u64() {
                u as i64
            } else if let Some(f) = n.as_f64() {
                f as i64
            } else {
                return Err(format!("unparseable number: {n}"));
            };
            Ok(normalise_epoch(raw))
        }
        serde_json::Value::String(s) => parse_timestamp_string(s),
        other => Err(format!(
            "expected a timestamp (number or string), got {kind}",
            kind = json_type_name(other),
        )),
    }
}

/// Promote seconds to millis when the value is suspiciously small.
fn normalise_epoch(raw: i64) -> i64 {
    if raw.abs() < SECONDS_VS_MILLIS_THRESHOLD {
        raw * 1000
    } else {
        raw
    }
}

/// Attempts to parse a string as either an ISO-8601 datetime or a plain number.
fn parse_timestamp_string(s: &str) -> Result<i64, String> {
    // Try numeric first (covers "1740000000000" and "1740000000")
    if let Ok(n) = s.parse::<i64>() {
        return Ok(normalise_epoch(n));
    }
    if let Ok(n) = s.parse::<f64>() {
        return Ok(normalise_epoch(n as i64));
    }

    // Try ISO-8601 with timezone (e.g. "2026-03-01T22:34:25.362Z")
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return Ok(dt.timestamp_millis());
    }

    // Try ISO-8601 without timezone — assume UTC
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f") {
        return Ok(dt.and_utc().timestamp_millis());
    }
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") {
        return Ok(dt.and_utc().timestamp_millis());
    }

    // Try date-only — midnight UTC
    if let Ok(d) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        let dt = d
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| format!("invalid date: {s}"))?;
        return Ok(dt.and_utc().timestamp_millis());
    }

    Err(format!("could not parse timestamp: \"{s}\""))
}

// ============================================================================
// flexible_bool_i64 — bool/int/string → i64 (0 or 1)
// ============================================================================

/// Accepts a JSON boolean, integer, or string and returns 0 or 1.
///
/// - `true` / `false` → 1 / 0
/// - `0` / `1` (or any non-zero int) → 0 / 1
/// - `"true"` / `"false"` / `"0"` / `"1"` — parsed accordingly
pub fn flexible_bool_i64<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    let val = serde_json::Value::deserialize(deserializer)?;
    value_to_bool_i64(&val).map_err(serde::de::Error::custom)
}

fn value_to_bool_i64(val: &serde_json::Value) -> Result<i64, String> {
    match val {
        serde_json::Value::Bool(b) => Ok(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(if i != 0 { 1 } else { 0 })
            } else if let Some(f) = n.as_f64() {
                Ok(if f != 0.0 { 1 } else { 0 })
            } else {
                Err(format!("unparseable boolean number: {n}"))
            }
        }
        serde_json::Value::String(s) => match s.to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" => Ok(1),
            "false" | "0" | "no" => Ok(0),
            other => Err(format!("could not parse boolean from string: \"{other}\"")),
        },
        serde_json::Value::Null => Ok(0),
        other => Err(format!(
            "expected a boolean (bool, int, or string), got {kind}",
            kind = json_type_name(other),
        )),
    }
}

// ============================================================================
// Helpers
// ============================================================================

fn json_type_name(val: &serde_json::Value) -> &'static str {
    match val {
        serde_json::Value::Null => "null",
        serde_json::Value::Bool(_) => "bool",
        serde_json::Value::Number(_) => "number",
        serde_json::Value::String(_) => "string",
        serde_json::Value::Array(_) => "array",
        serde_json::Value::Object(_) => "object",
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    // Test wrapper structs so we exercise the real serde pipeline

    #[derive(Debug, Deserialize)]
    struct TsRecord {
        #[serde(deserialize_with = "flexible_timestamp")]
        ts: i64,
    }

    #[derive(Debug, Deserialize)]
    struct OptTsRecord {
        #[serde(default, deserialize_with = "flexible_opt_timestamp")]
        ts: Option<i64>,
    }

    #[derive(Debug, Deserialize)]
    struct BoolRecord {
        #[serde(deserialize_with = "flexible_bool_i64")]
        flag: i64,
    }

    #[derive(Debug, Deserialize)]
    struct JsonStrRecord {
        #[serde(deserialize_with = "stringify_json")]
        data: String,
    }

    // ── stringify_json ─────────────────────────────────────────────────

    #[test]
    fn stringify_json_passes_string_through() {
        let r: JsonStrRecord = serde_json::from_str(r#"{"data": "{\"a\":1}"}"#).unwrap();
        assert_eq!(r.data, "{\"a\":1}");
    }

    #[test]
    fn stringify_json_serializes_object() {
        let r: JsonStrRecord = serde_json::from_str(r#"{"data": {"a": 1}}"#).unwrap();
        assert_eq!(r.data, "{\"a\":1}");
    }

    #[test]
    fn stringify_json_serializes_empty_object() {
        let r: JsonStrRecord = serde_json::from_str(r#"{"data": {}}"#).unwrap();
        assert_eq!(r.data, "{}");
    }

    #[test]
    fn stringify_json_serializes_array() {
        let r: JsonStrRecord = serde_json::from_str(r#"{"data": [1, 2]}"#).unwrap();
        assert_eq!(r.data, "[1,2]");
    }

    #[test]
    fn stringify_json_serializes_number() {
        let r: JsonStrRecord = serde_json::from_str(r#"{"data": 42}"#).unwrap();
        assert_eq!(r.data, "42");
    }

    #[test]
    fn stringify_json_serializes_null() {
        let r: JsonStrRecord = serde_json::from_str(r#"{"data": null}"#).unwrap();
        assert_eq!(r.data, "null");
    }

    // ── flexible_timestamp: integer inputs ─────────────────────────────

    #[test]
    fn ts_millis_passthrough() {
        // Value > 10B → treated as millis already
        let r: TsRecord = serde_json::from_str(r#"{"ts": 1740000000000}"#).unwrap();
        assert_eq!(r.ts, 1740000000000);
    }

    #[test]
    fn ts_seconds_promoted() {
        // Value < 10B → treated as seconds, multiplied by 1000
        let r: TsRecord = serde_json::from_str(r#"{"ts": 1740000000}"#).unwrap();
        assert_eq!(r.ts, 1740000000000);
    }

    #[test]
    fn ts_zero() {
        let r: TsRecord = serde_json::from_str(r#"{"ts": 0}"#).unwrap();
        assert_eq!(r.ts, 0);
    }

    #[test]
    fn ts_float_truncated() {
        let r: TsRecord = serde_json::from_str(r#"{"ts": 1740000000.999}"#).unwrap();
        assert_eq!(r.ts, 1740000000000); // seconds → millis
    }

    // ── flexible_timestamp: string inputs ──────────────────────────────

    #[test]
    fn ts_iso8601_utc() {
        let r: TsRecord = serde_json::from_str(r#"{"ts": "2026-03-01T22:34:25.362Z"}"#).unwrap();
        // Verify round-trip: parse back and check it lands in the right ballpark
        let dt = chrono::DateTime::from_timestamp_millis(r.ts).unwrap();
        assert_eq!(
            dt.format("%Y-%m-%dT%H:%M:%S").to_string(),
            "2026-03-01T22:34:25"
        );
    }

    #[test]
    fn ts_iso8601_with_offset() {
        let r: TsRecord = serde_json::from_str(r#"{"ts": "2026-03-01T22:34:25+05:00"}"#).unwrap();
        let dt = chrono::DateTime::from_timestamp_millis(r.ts).unwrap();
        // 22:34 +05:00 = 17:34 UTC
        assert_eq!(dt.format("%H:%M").to_string(), "17:34");
    }

    #[test]
    fn ts_iso8601_no_tz() {
        let r: TsRecord = serde_json::from_str(r#"{"ts": "2026-03-01T22:34:25"}"#).unwrap();
        let dt = chrono::DateTime::from_timestamp_millis(r.ts).unwrap();
        assert_eq!(dt.format("%Y-%m-%d").to_string(), "2026-03-01");
    }

    #[test]
    fn ts_date_only() {
        let r: TsRecord = serde_json::from_str(r#"{"ts": "2026-03-01"}"#).unwrap();
        let dt = chrono::DateTime::from_timestamp_millis(r.ts).unwrap();
        assert_eq!(
            dt.format("%Y-%m-%dT%H:%M:%S").to_string(),
            "2026-03-01T00:00:00"
        );
    }

    #[test]
    fn ts_numeric_string_millis() {
        let r: TsRecord = serde_json::from_str(r#"{"ts": "1740000000000"}"#).unwrap();
        assert_eq!(r.ts, 1740000000000);
    }

    #[test]
    fn ts_numeric_string_seconds() {
        let r: TsRecord = serde_json::from_str(r#"{"ts": "1740000000"}"#).unwrap();
        assert_eq!(r.ts, 1740000000000);
    }

    #[test]
    fn ts_rejects_object() {
        let r = serde_json::from_str::<TsRecord>(r#"{"ts": {}}"#);
        assert!(r.is_err());
    }

    #[test]
    fn ts_rejects_garbage_string() {
        let r = serde_json::from_str::<TsRecord>(r#"{"ts": "not-a-date"}"#);
        assert!(r.is_err());
    }

    // ── flexible_opt_timestamp ─────────────────────────────────────────

    #[test]
    fn opt_ts_null() {
        let r: OptTsRecord = serde_json::from_str(r#"{"ts": null}"#).unwrap();
        assert_eq!(r.ts, None);
    }

    #[test]
    fn opt_ts_missing() {
        let r: OptTsRecord = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(r.ts, None);
    }

    #[test]
    fn opt_ts_present_millis() {
        let r: OptTsRecord = serde_json::from_str(r#"{"ts": 1740000000000}"#).unwrap();
        assert_eq!(r.ts, Some(1740000000000));
    }

    #[test]
    fn opt_ts_present_iso() {
        let r: OptTsRecord = serde_json::from_str(r#"{"ts": "2026-03-01T00:00:00Z"}"#).unwrap();
        assert!(r.ts.is_some());
    }

    // ── flexible_bool_i64 ──────────────────────────────────────────────

    #[test]
    fn bool_true() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": true}"#).unwrap();
        assert_eq!(r.flag, 1);
    }

    #[test]
    fn bool_false() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": false}"#).unwrap();
        assert_eq!(r.flag, 0);
    }

    #[test]
    fn bool_int_1() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": 1}"#).unwrap();
        assert_eq!(r.flag, 1);
    }

    #[test]
    fn bool_int_0() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": 0}"#).unwrap();
        assert_eq!(r.flag, 0);
    }

    #[test]
    fn bool_int_nonzero() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": 42}"#).unwrap();
        assert_eq!(r.flag, 1);
    }

    #[test]
    fn bool_string_true() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": "true"}"#).unwrap();
        assert_eq!(r.flag, 1);
    }

    #[test]
    fn bool_string_false() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": "false"}"#).unwrap();
        assert_eq!(r.flag, 0);
    }

    #[test]
    fn bool_string_yes() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": "yes"}"#).unwrap();
        assert_eq!(r.flag, 1);
    }

    #[test]
    fn bool_string_no() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": "no"}"#).unwrap();
        assert_eq!(r.flag, 0);
    }

    #[test]
    fn bool_null_is_false() {
        let r: BoolRecord = serde_json::from_str(r#"{"flag": null}"#).unwrap();
        assert_eq!(r.flag, 0);
    }

    #[test]
    fn bool_rejects_array() {
        let r = serde_json::from_str::<BoolRecord>(r#"{"flag": [1]}"#);
        assert!(r.is_err());
    }

    #[test]
    fn bool_rejects_garbage_string() {
        let r = serde_json::from_str::<BoolRecord>(r#"{"flag": "maybe"}"#);
        assert!(r.is_err());
    }

    // ── normalise_epoch edge cases ─────────────────────────────────────

    #[test]
    fn normalise_boundary_just_below() {
        // 9_999_999_999 is < threshold → treated as seconds
        assert_eq!(normalise_epoch(9_999_999_999), 9_999_999_999_000);
    }

    #[test]
    fn normalise_boundary_exact() {
        // 10_000_000_000 is = threshold → treated as millis
        assert_eq!(normalise_epoch(10_000_000_000), 10_000_000_000);
    }

    #[test]
    fn normalise_negative_seconds() {
        // Negative seconds (pre-epoch) should still be promoted
        assert_eq!(normalise_epoch(-100), -100_000);
    }

    // ── proptest ───────────────────────────────────────────────────────

    #[cfg(test)]
    mod proptests {
        use super::*;
        use proptest::prelude::*;

        proptest! {
            // Any millis timestamp that survives a round-trip through ISO-8601
            // should deserialize back to the same value (±1ms from fractional
            // truncation in chrono formatting).
            #[test]
            fn roundtrip_millis_via_iso(ms in 0i64..4_102_444_800_000i64) {
                let dt = chrono::DateTime::from_timestamp_millis(ms).unwrap();
                let iso = dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
                let json = format!(r#"{{"ts": "{iso}"}}"#);
                let r: TsRecord = serde_json::from_str(&json).unwrap();
                prop_assert!((r.ts - ms).abs() <= 1,
                    "roundtrip mismatch: input={ms} output={} iso={iso}", r.ts);
            }

            // Any value >= threshold should pass through unchanged (millis)
            #[test]
            fn millis_passthrough(ms in 10_000_000_000i64..i64::MAX) {
                prop_assert_eq!(normalise_epoch(ms), ms);
            }

            // Any value < threshold should be promoted to millis
            #[test]
            fn seconds_promotion(s in 0i64..10_000_000_000i64) {
                prop_assert_eq!(normalise_epoch(s), s * 1000);
            }

            // stringify_json should never fail regardless of input
            #[test]
            fn stringify_never_panics(s in ".*") {
                let json = serde_json::json!({"data": s});
                let r: JsonStrRecord = serde_json::from_value(json).unwrap();
                prop_assert_eq!(r.data, s);
            }
        }
    }
}
