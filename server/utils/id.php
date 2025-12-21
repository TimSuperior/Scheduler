<?php
declare(strict_types=1);

function base62_id(int $length = 10): string
{
    $length = max(8, min(20, $length));
    $alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    $alphaLen = strlen($alphabet);

    $bytes = random_bytes($length);
    $out = '';

    for ($i = 0; $i < $length; $i++) {
        $out .= $alphabet[ord($bytes[$i]) % $alphaLen];
    }
    return $out;
}

function is_valid_id(string $id): bool
{
    return (bool)preg_match('/^[0-9A-Za-z]{8,20}$/', $id);
}
