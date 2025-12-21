<?php
declare(strict_types=1);

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
    $stmt = $pdo->prepare('SELECT payload, expires_at FROM public_schedules WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    if (!$row) send_json(['success' => false, 'error' => 'NOT_FOUND'], 404);

    if (!empty($row['expires_at'])) {
        $exp = strtotime((string)$row['expires_at']);
        if ($exp !== false && time() > $exp) {
            send_json(['success' => false, 'error' => 'EXPIRED'], 410);
        }
    }

    $payloadRaw = (string)$row['payload'];
    $payload = json_decode($payloadRaw, true);

    if (!is_array($payload)) {
        send_json(['success' => false, 'error' => 'CORRUPT_PAYLOAD'], 500);
    }

    send_json(['success' => true, 'id' => $id, 'payload' => $payload], 200);

} catch (Throwable) {
    send_json(['success' => false, 'error' => 'SERVER_ERROR'], 500);
}
