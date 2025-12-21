<?php
declare(strict_types=1);

/**
 * server/pages/embed.php
 * Minimal embed shell (iframe friendly). Injects window.__SCHEDULE__.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';
require_once __DIR__ . '/../utils/validate.php';

$id = get_id_from_request();
if (!is_valid_id($id)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Bad or missing id.";
    exit;
}

$pdo = db();
$stmt = $pdo->prepare('SELECT payload, expires_at FROM public_schedules WHERE id = :id LIMIT 1');
$stmt->execute([':id' => $id]);
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Not found.";
    exit;
}

if (!empty($row['expires_at'])) {
    $exp = strtotime((string)$row['expires_at']);
    if ($exp !== false && time() > $exp) {
        http_response_code(410);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Expired.";
        exit;
    }
}

set_security_headers();
$payloadRaw = (string)$row['payload'];
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Schedule Embed <?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?></title>

  <link rel="stylesheet" href="/public/assets/css/base.css">
  <link rel="stylesheet" href="/public/assets/css/schedule.css">

  <meta name="robots" content="noindex" />
  <style>
    html, body { margin:0; padding:0; height:100%; }
    body { background: transparent; }
    .wrap { height: 100%; }
    .board__scroll { max-height: 100vh; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="board" data-mode="weekly">
      <div class="board__header">
        <div class="board__corner"></div>
        <div class="board__days">
          <div class="dayhead">Mon</div><div class="dayhead">Tue</div><div class="dayhead">Wed</div>
          <div class="dayhead">Thu</div><div class="dayhead">Fri</div><div class="dayhead">Sat</div><div class="dayhead">Sun</div>
        </div>
      </div>

      <div class="board__scroll">
        <div class="times" aria-hidden="true">
          <div class="time">06:00</div><div class="time">07:00</div><div class="time">08:00</div><div class="time">09:00</div>
          <div class="time">10:00</div><div class="time">11:00</div><div class="time">12:00</div><div class="time">13:00</div>
          <div class="time">14:00</div><div class="time">15:00</div><div class="time">16:00</div><div class="time">17:00</div>
          <div class="time">18:00</div><div class="time">19:00</div><div class="time">20:00</div><div class="time">21:00</div>
          <div class="time">22:00</div><div class="time">23:00</div><div class="time">24:00</div>
        </div>

        <div class="gridwrap">
          <div class="gridlines" aria-hidden="true"></div>
          <div class="days">
            <div class="daycol" data-day="0"></div>
            <div class="daycol" data-day="1"></div>
            <div class="daycol" data-day="2"></div>
            <div class="daycol" data-day="3"></div>
            <div class="daycol" data-day="4"></div>
            <div class="daycol" data-day="5"></div>
            <div class="daycol" data-day="6"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.__SCHEDULE_ID__ = <?= json_encode($id, JSON_UNESCAPED_SLASHES) ?>;
    window.__SCHEDULE__ = <?= $payloadRaw ?>;
  </script>
  <script type="module" src="/public/assets/js/main.js"></script>
</body>
</html>
