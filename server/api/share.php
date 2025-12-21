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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method not allowed. Use POST.']);
}

$raw = file_get_contents('php://input');
if ($raw === false || trim($raw) === '') {
    respond(400, ['error' => 'Empty request body.']);
}

if (strlen($raw) > 200000) { // ~200 KB limit
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
    $now = time();

    // Store canonical JSON string (re-encode)
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);

    // Generate unique id
    $id = '';
    for ($i = 0; $i < 8; $i++) {
        $try = new_id(10);
        $stmt = $pdo->prepare('INSERT OR IGNORE INTO schedules (id, data, created_at, updated_at) VALUES (:id, :data, :c, :u)');
        $stmt->execute([
            ':id' => $try,
            ':data' => $json,
            ':c' => $now,
            ':u' => $now
        ]);

        if ($stmt->rowCount() === 1) {
            $id = $try;
            break;
        }
    }

    if ($id === '') {
        respond(500, ['error' => 'Could not generate unique id. Try again.']);
    }

    respond(200, ['id' => $id]);
} catch (Throwable $e) {
    respond(500, ['error' => 'Server error.', 'details' => $e->getMessage()]);
}
