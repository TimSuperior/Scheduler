<?php
declare(strict_types=1);

/**
 * DB connection helper (SQLite via PDO).
 * DB file lives at: /storage/database.sqlite (project root)
 */

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $root = dirname(__DIR__, 2); // schedule-builder/
    $dbPath = $root . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'database.sqlite';

    // Ensure storage directory exists
    $storageDir = dirname($dbPath);
    if (!is_dir($storageDir)) {
        @mkdir($storageDir, 0775, true);
    }

    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // Pragmas for better concurrency
    $pdo->exec("PRAGMA journal_mode = WAL;");
    $pdo->exec("PRAGMA synchronous = NORMAL;");
    $pdo->exec("PRAGMA foreign_keys = ON;");

    // Create table if needed
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS schedules (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    ");

    return $pdo;
}
