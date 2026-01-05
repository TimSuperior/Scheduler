<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';
require_once __DIR__ . '/../utils/validate.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function respond(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function ensure_schema(PDO $pdo): void {
    // Works on SQLite and most PDO drivers
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS schedules (
            id VARCHAR(32) PRIMARY KEY,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    ");
}

function is_duplicate_error(Throwable $e): bool {
    if (!($e instanceof PDOException)) return false;
    $info = $e->errorInfo ?? null;

    // SQLite constraint: 19
    if (is_array($info) && isset($info[1]) && (int)$info[1] === 19) return true;
    // MySQL duplicate: 1062
    if (is_array($info) && isset($info[1]) && (int)$info[1] === 1062) return true;

    // SQLSTATE for integrity constraint violation
    if ($e->getCode() === '23000') return true;

    return false;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method not allowed. Use POST.']);
}

$raw = file_get_contents('php://input');
if ($raw === false || trim($raw) === '') {
    respond(400, ['error' => 'Empty request body.']);
}

if (strlen($raw) > 200000) {
    respond(413, ['error' => 'Payload too large.']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(400, ['error' => 'Invalid JSON.']);
}

[$ok, $err] = validate_schedule($data);
if (!$ok) {
    respond(422, ['error' => $err]);
}

try {
    $pdo = db();
    ensure_schema($pdo);

    $now = time();
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);

    $stmt = $pdo->prepare('INSERT INTO schedules (id, data, created_at, updated_at) VALUES (:id, :data, :c, :u)');

    $id = '';
    for ($i = 0; $i < 12; $i++) {
        $try = new_id(10);
        try {
            $stmt->execute([
                ':id' => $try,
                ':data' => $json,
                ':c' => $now,
                ':u' => $now
            ]);
            $id = $try;
            break;
        } catch (Throwable $e) {
            if (is_duplicate_error($e)) continue;
            throw $e;
        }
    }

    if ($id === '') {
        respond(500, ['error' => 'Could not generate unique id. Try again.']);
    }

    respond(200, ['id' => $id]);
} catch (Throwable $e) {
    respond(500, ['error' => 'Server error.', 'details' => $e->getMessage()]);
}
