<?php
declare(strict_types=1);

/**
 * server/utils/id.php
 * Generates URL-safe, collision-resistant short IDs (base62).
 */

function base62_id(int $length = 10): string
{
    if ($length < 8) $length = 8;
    if ($length > 20) $length = 20;

    $alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    $alphaLen = strlen($alphabet);

    $bytes = random_bytes($length); // strong randomness
    $out = '';

    for ($i = 0; $i < $length; $i++) {
        $idx = ord($bytes[$i]) % $alphaLen;
        $out .= $alphabet[$idx];
    }

    return $out;
}

/**
 * Validates an ID format (base62 only, 8..20 chars).
 */
function is_valid_id(string $id): bool
{
    return (bool)preg_match('/^[0-9A-Za-z]{8,20}$/', $id);
}
