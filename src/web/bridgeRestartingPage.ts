const RESTARTING_PAGE_STYLE = `
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.25rem; }
    p { line-height: 1.5; color: #444; }
    .status { margin-top: 1.5rem; padding: 0.75rem 1rem; background: #f4f4f5; border-radius: 8px; }
`;

/** HTML shown while the Node process exits and the bridge comes back online. */
export function bridgeRestartingPageHtml(returnTo: string): string {
    const safeReturnTo = returnTo.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restarting bridge…</title>
  <style>${RESTARTING_PAGE_STYLE}</style>
</head>
<body>
  <h1>Restarting Matter bridge</h1>
  <p>The bridge is reloading cameras and refreshing the Matter parts list for SmartThings. This usually takes a few seconds.</p>
  <p class="status" id="status">Waiting for the bridge to come back online…</p>
  <p><a href="/">Open dashboard</a> if this page does not redirect automatically.</p>
  <script>
    const status = document.getElementById('status');
    let attempts = 0;
    const returnTo = '${safeReturnTo}';
    const poll = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        if (r.ok) {
          clearInterval(poll);
          status.textContent = 'Bridge is back online. Redirecting…';
          location.href = returnTo;
        }
      } catch (_) {}
      if (attempts >= 45) {
        clearInterval(poll);
        status.textContent = 'Still restarting — try opening the dashboard manually.';
      }
    }, 2000);
  </script>
</body>
</html>`;
}
