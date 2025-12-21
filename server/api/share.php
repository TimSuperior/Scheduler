<?php
declare(strict_types=1);

/**
 * server/api/share.php
 * POST JSON -> store -> return { id, url, embedUrl } with root-absolute links.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';
require_once __DIR__ . '/../utils/validate.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        send_json(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    // Limit abuse
    rate_limit('share', 30, 60);

    $raw = read_raw_body(200_000);
    $decoded = decode_json_object($raw);
    validate_schedule_shape($decoded);

    $pdo = db();

    // Generate unique ID (very low collision chance; still retry)
    $id = '';
    for ($i = 0; $i < 6; $i++) {
        $candidate = base62_id(10);
        $stmt = $pdo->prepare('SELECT 1 FROM public_schedules WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $candidate]);
        if (!$stmt->fetchColumn()) {
            $id = $candidate;
            break;
        }
    }
    if ($id === '') {
        throw new RuntimeException('Failed to generate unique ID.');
    }

    $nowIso = gmdate('c');

    // Optional: set an expiry (uncomment for 30 days)
    // $expiresIso = gmdate('c', time() + 30*24*3600);
    $expiresIso = null;

    $ins = $pdo->prepare("
        INSERT INTO public_schedules (id, payload, created_at, expires_at)
        VALUES (:id, :payload, :created_at, :expires_at)
    ");
    $ins->execute([
        ':id' => $id,
        ':payload' => $raw,         // store as raw JSON string
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
