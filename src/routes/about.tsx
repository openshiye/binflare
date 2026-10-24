import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [{ title: 'About — Binflare' }],
  }),
  component: About,
})

function About() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Binflare home">
          <span className="wordmark-mark">B</span>
          <span>BINFLARE</span>
        </a>
        <nav className="site-nav" aria-label="Main">
          <a href="/">New document</a>
        </nav>
      </header>
      <main className="site-main about">
        <p className="eyebrow">About</p>
        <h1>A Cloudflare implementation of the PrivateBin protocol.</h1>
        <p>
          Binflare creates and reads PrivateBin v2 documents in the browser. The server stores
          ciphertext and the metadata needed for expiry, burn-after-reading, comments and deletion.
          The decryption key is never sent to the server.
        </p>
        <h2>Compatibility</h2>
        <p>
          The protocol baseline is PrivateBin <code>2.1.0</code>. Existing PrivateBin clients can
          point their base URL at a Binflare instance. Binflare does not import data from an
          existing instance, and it does not support PrivateBin v1 or ZeroBin.
        </p>
        <h2>Security model</h2>
        <ul>
          <li>New documents use AES-GCM with a 256-bit random fragment key and optional password.</li>
          <li>The server never receives the key or password and cannot decrypt a document.</li>
          <li>Burn-after-reading deletes the document on first read; exactly one concurrent reader wins.</li>
          <li>Delete tokens are HMAC-SHA256 values; the per-document salt is never returned.</li>
          <li>Comments are encrypted with the document key; comment text and nicknames are not visible to the server.</li>
          <li>The HTML shell uses a strict script CSP, no third-party fonts or analytics, and no application cookies.</li>
        </ul>
        <h2>Limitations</h2>
        <ul>
          <li>D1 limits a document to 1.875 MB of ciphertext; larger attachments need v0.2/R2.</li>
          <li>Expired documents return a generic “does not exist” error; physical cleanup is lazy plus a Cron job.</li>
          <li><code>ctr</code>/<code>cbc</code> documents are read-only compatibility and are not authenticated.</li>
          <li>A malicious operator can serve modified JavaScript or retain a copy before burning. Zero knowledge protects data at rest, not a compromised client.</li>
          <li>No accounts, no password recovery, no data migration.</li>
        </ul>
        <h2>Not affiliated</h2>
        <p>
          Binflare is an independent implementation. It is not affiliated with, endorsed by, or an
          official distribution of the PrivateBin project. PrivateBin is © Sébastien Sauvage and
          the PrivateBin contributors, licensed under Zlib/libpng.
        </p>
        <p>
          <a href="/">Create a document</a>
        </p>
      </main>
      <footer className="site-footer">
        <span>Protocol-compatible with PrivateBin 2.1.0.</span>
        <span>Not affiliated with or endorsed by the PrivateBin project.</span>
      </footer>
    </div>
  )
}
