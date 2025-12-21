<?php
declare(strict_types=1);

/**
 * server/utils/validate.php
 * JSON helpers, validation, small rate limiter, and common headers.
 */

function set_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: SAMEORIGIN');
    // You can tighten CSP once frontend is stable:
    // header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self';");
}

function send_json(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    set_security_headers();
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_raw_body(int $maxBytes = 200_000): string
{
    $raw = file_get_contents('php://input');
    if ($raw === false) {
        throw new RuntimeException('Failed to read request body.');
    }
    if ($raw === '') {
        throw new InvalidArgumentException('Empty request body.');
    }
    if (strlen($raw) > $maxBytes) {
        throw new InvalidArgumentException('Payload too large.');
    }
    return $raw;
}

function decode_json_object(string $raw): array
{
    try {
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
        throw new InvalidArgumentException('Invalid JSON.');
    }
    if (!is_array($data)) {
        throw new InvalidArgumentException('JSON must be an object.');
    }
    return $data;
}

/**
 * Keep this LIGHT: backend stores payload as-is.
 * These checks prevent totally broken structures.
 */
function validate_schedule_shape(array $data): void
{
    if (isset($data['type']) && !in_array($data['type'], ['weekly', 'daily'], true)) {
        throw new InvalidArgumentException('Invalid schedule type.');
    }
    if (isset($data['blocks']) && !is_array($data['blocks'])) {
        throw new InvalidArgumentException('blocks must be an array.');
    }
}

/**
 * Simple file-based rate limit (good for shared hosting MVP).
 */
function rate_limit(string $bucket, int $maxRequests = 30, int $windowSec = 60): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = preg_replace('/[^a-zA-Z0-9_.:-]/', '_', $bucket . '_' . $ip);

    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'sb_rate_limit';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);

    $file = $dir . DIRECTORY_SEPARATOR . $key . '.json';
    $now = time();

    $state = ['reset' => $now + $windowSec, 'count' => 0];

    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($decoded) && isset($decoded['reset'], $decoded['count'])) {
            $state = $decoded;
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

    if ($state['count'] > $maxRequests) {
        header('Retry-After: ' . max(1, $state['reset'] - $now));
        send_json(['success' => false, 'error' => 'RATE_LIMITED'], 429);
    }
}

/**
 * ID can come from ?id= or PATH_INFO (/view.php/Abc123...)
 */
function get_id_from_request(): string
{
    $id = (string)($_GET['id'] ?? '');
    if ($id !== '') return $id;

    $pi = trim((string)($_SERVER['PATH_INFO'] ?? ''), '/');
    if ($pi !== '') return $pi;

    return '';
}
