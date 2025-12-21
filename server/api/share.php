<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';
require_once __DIR__ . '/../utils/validate.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        send_json(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    rate_limit('share', 30, 60);

    $raw = read_raw_body(250_000);
    $data = decode_json_object($raw);
    validate_schedule_shape($data);

    $pdo = db();

    $id = '';
    for ($i = 0; $i < 8; $i++) {
        $candidate = base62_id(10);
        $stmt = $pdo->prepare('SELECT 1 FROM public_schedules WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $candidate]);
        if (!$stmt->fetchColumn()) { $id = $candidate; break; }
    }
    if ($id === '') throw new RuntimeException('Failed to generate unique id.');

    $nowIso = gmdate('c');
    $expiresIso = null; // set ISO time if you want expiry

    $ins = $pdo->prepare("
        INSERT INTO public_schedules (id, payload, created_at, expires_at)
        VALUES (:id, :payload, :created_at, :expires_at)
    ");
    $ins->execute([
        ':id' => $id,
        ':payload' => $raw,
        ':created_at' => $nowIso,
        ':expires_at' => $expiresIso,
    ]);

    send_json([
        'success' => true,
        'id' => $id,
        'url' => "/s/$id",
        'embedUrl' => "/embed/$id",
        'createdAt' => $nowIso,
    ], 201);

} catch (InvalidArgumentException $e) {
    send_json(['success' => false, 'error' => 'BAD_REQUEST', 'message' => $e->getMessage()], 400);
} catch (Throwable) {
    send_json(['success' => false, 'error' => 'SERVER_ERROR'], 500);
}
