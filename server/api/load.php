<?php
declare(strict_types=1);

/**
 * server/api/load.php
 * GET ?id=XXXX -> returns stored schedule JSON payload.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';
require_once __DIR__ . '/../utils/validate.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        send_json(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $id = (string)($_GET['id'] ?? '');
    if (!is_valid_id($id)) {
        send_json(['success' => false, 'error' => 'BAD_ID'], 400);
    }

    $pdo = db();

    $stmt = $pdo->prepare("
        SELECT payload, expires_at
        FROM public_schedules
        WHERE id = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    if (!$row) {
        send_json(['success' => false, 'error' => 'NOT_FOUND'], 404);
    }

    // Optional expiry enforcement
    if (!empty($row['expires_at'])) {
        $exp = strtotime((string)$row['expires_at']);
        if ($exp !== false && time() > $exp) {
            send_json(['success' => false, 'error' => 'EXPIRED'], 410);
        }
    }

    // payload is stored as raw JSON string
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    http_response_code(200);

    echo json_encode([
        'success' => true,
        'id' => $id,
        'payload' => json_decode((string)$row['payload'], true), // decoded for convenience
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    exit;

} catch (Throwable $e) {
    send_json(['success' => false, 'error' => 'SERVER_ERROR'], 500);
}
