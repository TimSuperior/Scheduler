<?php
declare(strict_types=1);

/**
 * Generate URL-safe IDs (base62-like)
 */

function new_id(int $len = 10): string
{
    $alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $max = strlen($alphabet) - 1;

    // random_bytes -> uniform distribution
    $bytes = random_bytes($len);
    $out = '';

    for ($i = 0; $i < $len; $i++) {
        $out .= $alphabet[ord($bytes[$i]) % ($max + 1)];
    }
    return $out;
}

function is_valid_id(string $id): bool
{
    // allow base62 only, 6..24 chars
    return (bool)preg_match('/^[0-9a-zA-Z]{6,24}$/', $id);
}
