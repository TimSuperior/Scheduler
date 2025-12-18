<?php
declare(strict_types=1);

/**
 * server/utils/validate.php
 * Input validation helpers (lightweight; backend stores JSON as-is).
 */

function send_json(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_raw_body(int $maxBytes = 150_000): string
{
    $raw = file_get_contents('php://input');
    if ($raw === false) {
        throw new RuntimeException("Failed to read request body.");
    }
    if (strlen($raw) === 0) {
        throw new InvalidArgumentException("Empty request body.");
    }
    if (strlen($raw) > $maxBytes) {
        throw new InvalidArgumentException("Payload too large.");
    }
    return $raw;
}

/**
 * Decode JSON safely.
 * Returns decoded array, but we still store original raw string to preserve exact client payload.
 */
function decode_json_array(string $raw): array
{
    try {
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        throw new InvalidArgumentException("Invalid JSON.");
    }
    if (!is_array($data)) {
        throw new InvalidArgumentException("JSON must be an object.");
    }
    return $data;
}

/**
 * Optional “shape” validation (kept permissive).
 * You can tighten this later without changing storage strategy.
 */
function validate_schedule_shape(array $data): void
{
    // Very light checks (don’t over-constrain MVP)
    if (isset($data['type']) && !in_array($data['type'], ['weekly', 'daily'], true)) {
        throw new InvalidArgumentException("Invalid schedule type.");
    }
    if (isset($data['blocks']) && !is_array($data['blocks'])) {
        throw new InvalidArgumentException("blocks must be an array.");
    }
}

/**
 * Basic file-based rate limit: N requests per windowSec per IP.
 * Works on shared hosting; good enough for MVP.
 */
function rate_limit(string $key, int $max = 20, int $windowSec = 60): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $bucketKey = preg_replace('/[^a-zA-Z0-9_\-:.]/', '_', $key . '_' . $ip);

    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'sb_rate_limit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }

    $file = $dir . DIRECTORY_SEPARATOR . $bucketKey . '.json';
    $now = time();

    $state = ['reset' => $now + $windowSec, 'count' => 0];

    if (is_file($file)) {
        $raw = @file_get_contents($file);
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && isset($decoded['reset'], $decoded['count'])) {
                $state = $decoded;
            }
        }
    }

    if (!is_int($state['reset']) || !is_int($state['count'])) {
        $state = ['reset' => $now + $windowSec, 'count' => 0];
    }

    if ($now > $state['reset']) {
        $state = ['reset' => $now + $windowSec, 'count' => 0];
    }

    $state['count']++;

    @file_put_contents($file, json_encode($state), LOCK_EX);

    if ($state['count'] > $max) {
        header('Retry-After: ' . max(1, $state['reset'] - $now));
        send_json(['success' => false, 'error' => 'RATE_LIMITED'], 429);
    }
}
