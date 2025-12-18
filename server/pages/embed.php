<?php
declare(strict_types=1);

/**
 * server/pages/embed.php
 * Minimal embed page for /embed/{id}
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';

function get_id_from_request(): string
{
    if (!empty($_GET['id'])) return (string)$_GET['id'];
    $pathInfo = $_SERVER['PATH_INFO'] ?? '';
    $pathInfo = trim($pathInfo, '/');
    if ($pathInfo !== '') return $pathInfo;
    return '';
}

$id = get_id_from_request();
if (!is_valid_id($id)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Bad or missing id.";
    exit;
}

$pdo = db();
$stmt = $pdo->prepare("SELECT payload, expires_at FROM public_schedules WHERE id = :id LIMIT 1");
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

$payloadRaw = (string)$row['payload'];
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Schedule Embed <?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?></title>
  <meta name="robots" content="noindex" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    #app { height: 100%; }
    pre { margin: 0; padding: 12px; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <div id="app">
    <pre id="json"></pre>
  </div>

  <script>
    window.__SCHEDULE_ID__ = <?= json_encode($id, JSON_UNESCAPED_SLASHES) ?>;
    window.__SCHEDULE__ = <?= $payloadRaw ?>;
    document.getElementById('json').textContent = JSON.stringify(window.__SCHEDULE__, null, 2);
  </script>

  <script type="module" src="/public/assets/js/main.js"></script>
</body>
</html>
