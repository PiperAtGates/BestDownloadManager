use sqlx::{sqlite::SqlitePoolOptions, SqlitePool, Row};
use std::env;

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn init(db_url: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(db_url)
            .await?;

        // Initialize schema for download history and credentials
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS site_credentials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL,
                password_encrypted TEXT NOT NULL
            );"
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }

    pub async fn get_credentials(&self, domain: &str) -> Result<Option<(String, String)>, sqlx::Error> {
        let row = sqlx::query("SELECT username, password_encrypted FROM site_credentials WHERE domain = ?")
            .bind(domain)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(r) = row {
            let user: String = r.get("username");
            let pass_enc: String = r.get("password_encrypted");
            // In a real app, we would decrypt the password here using AES-256-GCM.
            Ok(Some((user, pass_enc)))
        } else {
            Ok(None)
        }
    }
}
