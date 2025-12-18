<?php
declare(strict_types=1);

/**
 * server/api/share.php
 * POST JSON schedule -> stores snapshot -> returns share URLs.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';
require_once __DIR__ . '/../utils/validate.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        send_json(['success' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    // Rate-limit share endpoint (adjust numbers as needed)
    rate_limit('share', 30, 60);

    // Read + validate payload
    $raw = read_raw_body(200_000);
    $decoded = decode_json_array($raw);
    validate_schedule_shape($decoded);

    $pdo = db();

    // Generate unique ID (retry a few times in the rare case of collision)
    $id = '';
    for ($i = 0; $i < 5; $i++) {
        $candidate = base62_id(10);
        $stmt = $pdo->prepare("SELECT 1 FROM public_schedules WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $candidate]);
        if (!$stmt->fetchColumn()) {
            $id = $candidate;
            break;
        }
    }
    if ($id === '') {
        throw new RuntimeException("Failed to generate unique ID.");
    }

    $nowIso = gmdate('c');

    // Optional expiry: set null for “no expiry”. Or set e.g. +30 days:
    // $expiresIso = gmdate('c', time() + 30*24*3600);
    $expiresIso = null;

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

    // Build URLs (relative)
    $viewUrl  = "/s/$id";
    $embedUrl = "/embed/$id";

    send_json([
        'success' => true,
        'id' => $id,
        'url' => $viewUrl,
        'embedUrl' => $embedUrl,
        'createdAt' => $nowIso
    ], 201);

} catch (InvalidArgumentException $e) {
    send_json(['success' => false, 'error' => 'BAD_REQUEST', 'message' => $e->getMessage()], 400);
} catch (Throwable $e) {
    send_json(['success' => false, 'error' => 'SERVER_ERROR'], 500);
}
