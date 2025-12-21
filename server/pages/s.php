<?php
declare(strict_types=1);

require_once __DIR__ . '/../utils/id.php';

function extract_id(): string {
    if (!empty($_GET['id'])) return (string)$_GET['id'];

    // PATH_INFO support: /s.php/ID
    $pathInfo = $_SERVER['PATH_INFO'] ?? '';
    if ($pathInfo) {
        $candidate = trim($pathInfo, "/");
        return $candidate;
    }

    // Fallback: last segment of REQUEST_URI
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $parts = explode('?', $uri, 2);
    $path = $parts[0];
    $segments = array_values(array_filter(explode('/', $path)));
    return (string)end($segments);
}

$id = trim(extract_id());

if (!is_valid_id($id)) {
    http_response_code(400);
    echo "Invalid schedule id.";
    exit;
}

$dest = "/public/app/view.html?id=" . rawurlencode($id);

// Prefer HTTP redirect
header("Location: {$dest}", true, 302);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=<?= htmlspecialchars($dest, ENT_QUOTES) ?>">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Redirecting…</title>
</head>
<body>
  Redirecting… If not, <a href="<?= htmlspecialchars($dest, ENT_QUOTES) ?>">click here</a>.
</body>
</html>
