import { createFileRoute } from '@tanstack/react-router'
import { SiteHeader } from '../components/site-header'
import { useI18n } from '../lib/i18n'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [{ title: 'About — Binflare' }],
  }),
  component: About,
})

function About() {
  const { lang, t } = useI18n()
  const zh = lang === 'zh'

  return (
    <div className="app-shell">
      <SiteHeader current="about" />
      <main className="site-main about">
        {zh ? (
          <>
            <p className="eyebrow">关于</p>
            <h1>PrivateBin 协议在 Cloudflare 上的实现。</h1>
            <p>
              Binflare 在浏览器里创建和读取 PrivateBin v2 文档。服务端只保存密文，以及过期、阅后即焚、评论和删除所需的元数据；解密密钥不会发送到服务端。
            </p>
            <h2>兼容性</h2>
            <p>
              协议基线是 PrivateBin <code>2.1.0</code>。现有 PrivateBin 客户端可以把 base URL 指向 Binflare。
              Binflare 不导入现有实例的数据，也不支持 PrivateBin v1 或 ZeroBin。
            </p>
            <h2>安全模型</h2>
            <ul>
              <li>新文档使用 AES-GCM，256 位随机 fragment 密钥加可选口令。</li>
              <li>服务端永远收不到密钥或口令，无法解密文档。</li>
              <li>阅后即焚在首次读取时删除文档；并发首读只有一个读者能拿到内容。</li>
              <li>删除令牌是 HMAC-SHA256；每个文档的 salt 永不下发。</li>
              <li>评论使用文档密钥加密；评论正文和昵称对服务端不可见。</li>
              <li>HTML 壳使用严格脚本 CSP，无第三方字体或分析，无应用 Cookie。</li>
            </ul>
            <h2>限制</h2>
            <ul>
              <li>小型密文存 D1（单行上限约 1.875 MB）；更大密文转 R2，默认上限 10 MB。</li>
              <li>过期读取返回通用“不存在”；物理清理由读时删除和 Cron 完成；R2 对象删除失败时可能留下无主密文。</li>
              <li><code>ctr</code>/<code>cbc</code> 仅只读兼容且无认证。</li>
              <li>恶意运营者可以替换 JavaScript，或在焚毁前保留副本；零知识保护静态数据，不保护被篡改的客户端。</li>
              <li>阅后即焚加口令时，读取本身会销毁文档；口令错误也会消耗它。</li>
              <li>无账户、无口令找回、不迁移旧数据。</li>
            </ul>
            <h2>无隶属</h2>
            <p>
              Binflare 是独立实现，与 PrivateBin 项目无隶属、无背书，也不是官方发行版。PrivateBin 版权归 Sébastien Sauvage 及贡献者，使用 Zlib/libpng 许可证。
            </p>
            <p><a href="/">{t('Back to editor')}</a></p>
          </>
        ) : (
          <>
            <p className="eyebrow">About</p>
            <h1>A Cloudflare implementation of the PrivateBin protocol.</h1>
            <p>
              Binflare creates and reads PrivateBin v2 documents in the browser. The server stores
              ciphertext and the metadata needed for expiry, burn-after-reading, comments and
              deletion. The decryption key is never sent to the server.
            </p>
            <h2>Compatibility</h2>
            <p>
              The protocol baseline is PrivateBin <code>2.1.0</code>. Existing PrivateBin clients
              can point their base URL at a Binflare instance. Binflare does not import data from an
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
              <li>Small ciphertext lives in D1 (about 1.875 MB row cap); larger ciphertext goes to R2, default cap 10 MB.</li>
              <li>Expired documents return a generic “does not exist” error; cleanup is lazy plus a Cron job. A failed R2 delete can leave orphaned ciphertext.</li>
              <li><code>ctr</code>/<code>cbc</code> documents are read-only compatibility and are not authenticated.</li>
              <li>A malicious operator can serve modified JavaScript or retain a copy before burning. Zero knowledge protects data at rest, not a compromised client.</li>
              <li>Burn + password: reading destroys the document even if the password is wrong.</li>
              <li>No accounts, no password recovery, no data migration.</li>
            </ul>
            <h2>Not affiliated</h2>
            <p>
              Binflare is an independent implementation. It is not affiliated with, endorsed by, or
              an official distribution of the PrivateBin project. PrivateBin is © Sébastien Sauvage
              and the PrivateBin contributors, licensed under Zlib/libpng.
            </p>
            <p><a href="/">{t('New document')}</a></p>
          </>
        )}
      </main>
      <footer className="site-footer">
        <span>{t('Protocol-compatible with PrivateBin 2.1.0.')}</span>
        <span>{t('Not affiliated with or endorsed by the PrivateBin project.')}</span>
      </footer>
    </div>
  )
}
