<?php
declare(strict_types=1);

/**
 * server/config/db.php
 * Returns a PDO connection to SQLite and ensures required table exists.
 */

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $dbPath = realpath(__DIR__ . '/../../storage');
    if ($dbPath === false) {
        throw new RuntimeException("Storage directory not found.");
    }

    $file = $dbPath . DIRECTORY_SEPARATOR . 'database.sqlite';

    // Ensure storage directory is writable
    if (!is_dir($dbPath) || !is_writable($dbPath)) {
        throw new RuntimeException("Storage directory is not writable: " . $dbPath);
    }

    $pdo = new PDO('sqlite:' . $file, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // Reasonable defaults
    $pdo->exec('PRAGMA journal_mode = WAL;');
    $pdo->exec('PRAGMA synchronous = NORMAL;');
    $pdo->exec('PRAGMA foreign_keys = ON;');

    // Create table if not exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS public_schedules (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NULL
        );
    ");

    // Optional index for expiry cleanup (if you add a cron later)
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_public_schedules_expires_at ON public_schedules (expires_at);");

    return $pdo;
}
