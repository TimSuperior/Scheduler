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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['error' => 'Method not allowed. Use GET.']);
}

$id = (string)($_GET['id'] ?? '');
$id = trim($id);

if (!is_valid_id($id)) {
    respond(400, ['error' => 'Invalid id.']);
}

try {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT data FROM schedules WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    if (!$row) {
        respond(404, ['error' => 'Not found.']);
    }

    // Return the stored JSON (as an object), not wrapped
    $decoded = json_decode($row['data'], true);
    if (!is_array($decoded)) {
        respond(500, ['error' => 'Corrupted data.']);
    }

    echo json_encode($decoded, JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $e) {
    respond(500, ['error' => 'Server error.', 'details' => $e->getMessage()]);
}
