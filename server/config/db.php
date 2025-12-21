<?php
declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $storageDir = realpath(__DIR__ . '/../../storage');
    if ($storageDir === false || !is_dir($storageDir)) {
        throw new RuntimeException('storage/ directory not found.');
    }
    if (!is_writable($storageDir)) {
        throw new RuntimeException('storage/ directory is not writable.');
    }

    $dbFile = $storageDir . DIRECTORY_SEPARATOR . 'database.sqlite';

    $pdo = new PDO('sqlite:' . $dbFile, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    $pdo->exec('PRAGMA journal_mode = WAL;');
    $pdo->exec('PRAGMA synchronous = NORMAL;');
    $pdo->exec('PRAGMA foreign_keys = ON;');

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS public_schedules (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NULL
        );
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_public_schedules_expires_at ON public_schedules(expires_at);");

    return $pdo;
}
