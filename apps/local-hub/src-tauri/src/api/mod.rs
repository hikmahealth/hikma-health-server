// Backwards-compatible REST API endpoints.
//
// These delegate to the RPC handlers internally but expose a traditional
// REST interface for clients that haven't migrated to the encrypted RPC
// protocol.

use poem::{handler, http::StatusCode, web::Json, IntoResponse};
use serde::Deserialize;

use crate::{open_encrypted_connection, GLOBAL_JWT_SIGNING_KEY};

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

/// POST /api/login
///
/// Accepts `{ "email": "...", "password": "..." }` and returns a JWT token
/// plus user metadata, or an error object with an appropriate status code.
#[handler]
pub async fn login(Json(body): Json<LoginRequest>) -> impl IntoResponse {
    println!("🚩 Login attempt through the API");
    let jwt_key_guard = GLOBAL_JWT_SIGNING_KEY.read();
    let jwt_key = match jwt_key_guard.as_deref() {
        Some(k) => k,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({ "error": "Server not fully initialized" })),
            )
                .into_response();
        }
    };

    let conn = match open_encrypted_connection() {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let data = serde_json::json!({ "email": body.email, "password": body.password });

    match crate::rpc::handlers::auth::handle_login(&data, &conn, jwt_key) {
        Ok(result) => Json(result).into_response(),
        Err(e) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
