function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

export function accessPage(returnTo: string, error: "invalid" | "limited" | null = null): Response {
  const safeReturnTo = escapeHtml(returnTo);
  const errorMessage = error === "limited"
    ? '<p class="error" role="alert">Too many attempts. Please wait 15 minutes and try again.</p>'
    : error === "invalid"
      ? '<p class="error" role="alert">That PIN is not correct. Please try again.</p>'
      : "";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Enter PIN — Factbook</title>
  <style>
    :root{color-scheme:light;--ink:#1e2422;--muted:#68706d;--cream:#fbfaf6;--navy:#243548;--coral:#d76b4b;--line:#d6d8d2;--blue:#c5d8e8}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--cream);color:var(--ink);font-family:Arial,sans-serif;display:grid;grid-template-rows:auto 1fr auto}
    header{height:78px;padding:0 5vw;display:flex;align-items:center;border-bottom:1px solid var(--line)}
    .brand{display:flex;align-items:center;gap:12px}.brand span{display:grid;place-items:center;min-width:64px;height:34px;padding:0 14px;border-radius:5px;background:var(--navy);color:white;font:bold 11px monospace;letter-spacing:.07em}.brand strong{font-size:17px;letter-spacing:-.02em}
    main{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.65fr);min-height:620px}
    .intro{padding:9vw 8vw;background:var(--navy);color:#f4f2eb;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden}.intro:after{content:"";position:absolute;width:430px;height:430px;right:-210px;top:-180px;border:1px solid rgba(255,255,255,.16);border-radius:50%;box-shadow:0 0 0 70px rgba(255,255,255,.03),0 0 0 140px rgba(255,255,255,.02)}
    .eyebrow{margin:0 0 24px;color:#adc4d5;font:bold 11px monospace;letter-spacing:.14em;text-transform:uppercase}.intro h1{max-width:700px;margin:0;font:normal clamp(50px,6vw,86px)/.95 Georgia,serif;letter-spacing:-.055em}.intro h1 em{color:#ed8868;font-weight:normal}.intro>p:last-child{max-width:580px;margin:30px 0 0;color:#bdc8ce;font-size:16px;line-height:1.65}
    .entry{padding:7vw;display:flex;align-items:center}.panel{width:min(100%,440px);margin:auto}.panel .eyebrow{color:#536b7e}.panel h2{margin:0 0 13px;font:normal 42px/1 Georgia,serif;letter-spacing:-.035em}.lede{margin:0 0 34px;color:var(--muted);font-size:15px;line-height:1.6}
    label{display:block;margin-bottom:10px;color:#53605b;font:bold 11px monospace;letter-spacing:.08em;text-transform:uppercase}.pin-row{display:grid;grid-template-columns:1fr auto;gap:10px}input{min-width:0;height:56px;border:1px solid #aeb6b1;border-radius:7px;background:#fff;padding:0 17px;color:var(--ink);font-size:22px;letter-spacing:.3em;outline:none}input:focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(36,53,72,.12)}button{height:56px;border:0;border-radius:7px;background:var(--coral);color:white;padding:0 23px;font-weight:bold;cursor:pointer}button:hover{background:#c55d3e}button:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
    .error{margin:13px 0 0;color:#a83d26;font-size:13px}.trust{display:flex;gap:10px;margin:25px 0 0;padding-top:22px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;line-height:1.55}.trust b{color:var(--navy)}
    footer{padding:22px 5vw;background:#172331;color:#9eacb8;font-size:11px}
    @media(max-width:780px){main{grid-template-columns:1fr}.intro{min-height:340px;padding:64px 24px}.intro h1{font-size:48px}.entry{padding:60px 24px}.pin-row{grid-template-columns:1fr}.pin-row button{width:100%}}
  </style>
</head>
<body>
  <header><div class="brand"><span>DATA</span><strong>Factbook</strong></div></header>
  <main>
    <section class="intro"><p class="eyebrow">Private access</p><h1>Philippine data,<br><em>made explorable.</em></h1><p>This Factbook is shared with a limited group. Enter the access PIN provided to you to continue.</p></section>
    <section class="entry"><div class="panel"><p class="eyebrow">Welcome to the Factbook</p><h2>Enter access PIN</h2><p class="lede">Use the six-digit PIN shared with you.</p><form method="post" action="/_factbook/access"><input type="hidden" name="returnTo" value="${safeReturnTo}"><label for="pin">Access PIN</label><div class="pin-row"><input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" aria-describedby="trust" required autofocus><button type="submit">Enter Factbook</button></div>${errorMessage}<p class="trust" id="trust"><span aria-hidden="true">✓</span><span><b>Trusted for 30 days.</b><br>You will not need to enter the PIN again on this device during that period.</span></p></form></div></section>
  </main>
  <footer>Factbook · Limited-access data collection</footer>
</body>
</html>`;
  return new Response(html, {
    status: error === "limited" ? 429 : error ? 401 : 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}


