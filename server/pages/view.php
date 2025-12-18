<?php
declare(strict_types=1);

/**
 * server/pages/view.php
 * Read-only public view page for /s/{id}
 * Expects ID from:
 *  - ?id=XXXX
 *  - or PATH_INFO like /view.php/XXXX (via rewrite)
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/id.php';

function get_id_from_request(): string
{
    // Prefer query param
    if (!empty($_GET['id'])) return (string)$_GET['id'];

    // Try PATH_INFO
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
$payloadForJs = $payloadRaw; // already JSON
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Schedule View <?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?></title>
  <meta name="robots" content="noindex" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 16px; }
    .wrap { max-width: 1000px; margin: 0 auto; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
    pre { white-space: pre-wrap; word-break: break-word; }
    .hint { color: #666; font-size: 14px; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Schedule (read-only)</h1>
    <div id="app" class="card">
      <noscript>Please enable JavaScript to render the schedule.</noscript>
      <div id="fallback">
        <pre id="json"></pre>
        <div class="hint">
          If you add a frontend renderer, it can read <code>window.__SCHEDULE__</code>.
        </div>
      </div>
    </div>
  </div>

  <script>
    // Injected payload for your frontend app
    window.__SCHEDULE_ID__ = <?= json_encode($id, JSON_UNESCAPED_SLASHES) ?>;
    window.__SCHEDULE__ = <?= $payloadForJs ?>;

    // Fallback: show JSON if no renderer replaces it
    document.getElementById('json').textContent = JSON.stringify(window.__SCHEDULE__, null, 2);

    // Optional: load your real frontend viewer if you have it
    // (Adjust the path to match your public JS bundle/module)
    // Example: /public/assets/js/main.js or /assets/js/main.js depending on hosting
  </script>

  <script type="module" src="/public/assets/js/main.js"></script>
</body>
</html>
