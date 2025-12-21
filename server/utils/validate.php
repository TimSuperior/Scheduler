<?php
declare(strict_types=1);

/**
 * Validate schedule payload structure for safety.
 * Returns [bool $ok, string $error]
 */

function validate_schedule($data): array
{
    if (!is_array($data)) return [false, 'Payload must be a JSON object.'];

    if (!isset($data['meta']) || !is_array($data['meta'])) {
        return [false, 'Missing "meta" object.'];
    }
    if (!isset($data['items']) || !is_array($data['items'])) {
        return [false, 'Missing "items" array.'];
    }

    $meta = $data['meta'];
    $items = $data['items'];

    // Limits
    if (count($items) > 500) return [false, 'Too many items (max 500).'];

    // Meta checks
    $title = (string)($meta['title'] ?? '');
    if (mb_strlen($title) > 120) return [false, 'Title too long (max 120).'];

    $days = $meta['days'] ?? null;
    if (!is_array($days) || count($days) < 1 || count($days) > 7) {
        return [false, '"meta.days" must be an array of 1..7 values.'];
    }
    foreach ($days as $d) {
        if (!is_string($d) || mb_strlen($d) < 1 || mb_strlen($d) > 12) {
            return [false, 'Each day label must be a short string.'];
        }
    }

    $start = $meta['startMinute'] ?? null;
    $end   = $meta['endMinute'] ?? null;
    $step  = $meta['minuteStep'] ?? null;
    $showWeekend = $meta['showWeekend'] ?? null;

    if (!is_int_like($start) || !is_int_like($end) || !is_int_like($step)) {
        return [false, '"startMinute", "endMinute", "minuteStep" must be numbers.'];
    }

    $start = (int)$start;
    $end = (int)$end;
    $step = (int)$step;

    if ($start < 0 || $start > 24 * 60) return [false, 'startMinute out of range.'];
    if ($end < 0 || $end > 24 * 60) return [false, 'endMinute out of range.'];
    if ($end <= $start) return [false, 'endMinute must be greater than startMinute.'];

    $allowedSteps = [5, 10, 15, 30, 60];
    if (!in_array($step, $allowedSteps, true)) return [false, 'minuteStep must be one of 5,10,15,30,60.'];

    if (!is_bool_like($showWeekend)) return [false, 'showWeekend must be boolean.'];

    // Items checks
    foreach ($items as $idx => $it) {
        if (!is_array($it)) return [false, "Item #$idx must be an object."];

        $dayIndex = $it['dayIndex'] ?? null;
        $s = $it['start'] ?? null;
        $e = $it['end'] ?? null;

        if (!is_int_like($dayIndex) || !is_int_like($s) || !is_int_like($e)) {
            return [false, "Item #$idx missing numeric fields (dayIndex/start/end)."];
        }

        $dayIndex = (int)$dayIndex;
        $s = (int)$s;
        $e = (int)$e;

        if ($dayIndex < 0 || $dayIndex > 6) return [false, "Item #$idx dayIndex out of range."];
        if ($s < $start || $s > $end) return [false, "Item #$idx start out of range."];
        if ($e < $start || $e > $end) return [false, "Item #$idx end out of range."];
        if ($e <= $s) return [false, "Item #$idx end must be greater than start."];
        if ((($e - $s) % $step) !== 0 && (($s - $start) % $step) !== 0) {
            // not a strict requirement, but helps keep data consistent
            // We won't reject on this; comment out if you want strict snapping.
        }

        $text = (string)($it['text'] ?? '');
        if (mb_strlen($text) < 1 || mb_strlen($text) > 80) {
            return [false, "Item #$idx text must be 1..80 chars."];
        }

        $color = (string)($it['color'] ?? '');
        if ($color !== '' && !preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            return [false, "Item #$idx color must be #RRGGBB."];
        }

        $notes = (string)($it['notes'] ?? '');
        if (mb_strlen($notes) > 500) return [false, "Item #$idx notes too long (max 500)."];

        $id = (string)($it['id'] ?? '');
        if ($id !== '' && !preg_match('/^[0-9a-zA-Z_-]{3,64}$/', $id)) {
            return [false, "Item #$idx has invalid id."];
        }
    }

    return [true, 'OK'];
}

function is_int_like($v): bool
{
    return is_int($v) || (is_numeric($v) && (string)(int)$v === (string)$v);
}

function is_bool_like($v): bool
{
    return is_bool($v) || $v === 0 || $v === 1 || $v === '0' || $v === '1';
}
