<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function respond(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function ensure_schema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS schedules (
            id VARCHAR(32) PRIMARY KEY,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    ");
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['error' => 'Method not allowed. Use GET.']);
}

$id = trim((string)($_GET['id'] ?? ''));
if (!is_valid_id($id)) {
    respond(400, ['error' => 'Invalid id.']);
}

try {
    $pdo = db();
    ensure_schema($pdo);

    $stmt = $pdo->prepare('SELECT data FROM schedules WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    if (!$row) {
        respond(404, ['error' => 'Not found.']);
    }

    $decoded = json_decode($row['data'], true);
    if (!is_array($decoded)) {
        respond(500, ['error' => 'Corrupted data.']);
    }

    echo json_encode($decoded, JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $e) {
    respond(500, ['error' => 'Server error.', 'details' => $e->getMessage()]);
}
