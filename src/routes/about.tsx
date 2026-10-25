import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Code2, ExternalLink } from 'lucide-react'
import { SiteHeader } from '../components/site-header'
import { SiteFooter } from '../components/site-footer'
import { AppShellSkeleton } from '../components/app-shell-skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useI18n } from '../lib/i18n'
import { useMounted } from '../lib/use-mounted'
import { PROJECT } from '../lib/project'

export const Route = createFileRoute('/about')({
  component: About,
})

function ExternalLinkIcon() {
  return <ExternalLink className="size-3.5" aria-hidden="true" />
}

function About() {
  const { lang, t } = useI18n()
  const mounted = useMounted()
  const zh = lang === 'zh'

  useEffect(() => {
    const previous = document.title
    document.title = zh ? '关于 — Binflare' : 'About — Binflare'
    return () => {
      document.title = previous
    }
  }, [zh])

  if (!mounted) {
    return <AppShellSkeleton />
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="about" />
      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-7 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {zh ? '源自 PrivateBin 的 Cloudflare 重写。' : 'A Cloudflare rewrite derived from PrivateBin.'}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {zh
              ? 'Binflare 是 PrivateBin 的 Cloudflare 重写/衍生项目，基于 PrivateBin 2.1.0 的 v2 协议与 JSON API。它在浏览器里创建和读取 PrivateBin v2 文档；服务端只保存密文，以及过期、阅后即焚、评论和删除所需的元数据，解密密钥不会发送到服务端。'
              : 'Binflare is a Cloudflare-native rewrite derived from PrivateBin, based on the PrivateBin 2.1.0 v2 protocol and JSON API. It creates and reads PrivateBin v2 documents in the browser. The server stores ciphertext and the metadata needed for expiry, burn-after-reading, comments and deletion. The decryption key is never sent to the server.'}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={PROJECT.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
            >
              <Code2 />
              {t('View on GitHub')}
            </a>
            <a
              href={PROJECT.upstreamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition hover:bg-accent hover:text-accent-foreground"
            >
              {t('Upstream PrivateBin')}
              <ExternalLinkIcon />
            </a>
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{zh ? '兼容性' : 'Compatibility'}</CardTitle>
              <CardDescription>
                {zh
                  ? '协议基线是 PrivateBin 2.1.0。现有 PrivateBin 客户端可以把 base URL 指向 Binflare。Binflare 不导入现有实例的数据，也不支持 PrivateBin v1 或 ZeroBin。'
                  : 'The protocol baseline is PrivateBin 2.1.0. Existing PrivateBin clients can point their base URL at a Binflare instance. Binflare does not import data from an existing instance, and it does not support PrivateBin v1 or ZeroBin.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href={PROJECT.protocolDocsUrl} target="_blank" rel="noopener noreferrer" className="text-sm">
                {t('Protocol baseline')} <ExternalLinkIcon />
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{zh ? '安全模型' : 'Security model'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                {(zh
                  ? [
                      '新文档使用 AES-GCM，256 位随机 fragment 密钥加可选口令。',
                      '服务端永远收不到密钥或口令，无法解密文档。',
                      '阅后即焚在首次读取时删除文档；并发首读只有一个读者能拿到内容。',
                      '删除令牌是 HMAC-SHA256；每个文档的 salt 永不下发。',
                      '评论使用文档密钥加密；评论正文和昵称对服务端不可见。',
                      'HTML 壳使用严格脚本 CSP，无第三方字体或分析，无应用 Cookie。',
                    ]
                  : [
                      'New documents use AES-GCM with a 256-bit random fragment key and optional password.',
                      'The server never receives the key or password and cannot decrypt a document.',
                      'Burn-after-reading deletes the document on first read; exactly one concurrent reader wins.',
                      'Delete tokens are HMAC-SHA256 values; the per-document salt is never returned.',
                      'Comments are encrypted with the document key; comment text and nicknames are not visible to the server.',
                      'The HTML shell uses a strict script CSP, no third-party fonts or analytics, and no application cookies.',
                    ]
                ).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{zh ? '限制' : 'Limitations'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                {(zh
                  ? [
                      '小型密文存 D1（单行上限约 1.875 MB）；更大密文转 R2，默认上限 10 MB。',
                      '过期读取返回通用“不存在”；物理清理由读时删除和 Cron 完成；R2 对象删除失败时可能留下无主密文。',
                      'ctr/cbc 仅只读兼容且无认证。',
                      '恶意运营者可以替换 JavaScript，或在焚毁前保留副本；零知识保护静态数据，不保护被篡改的客户端。',
                      '阅后即焚加口令时，读取本身会销毁文档；口令错误也会消耗它。',
                      '无账户、无口令找回、不迁移旧数据。',
                    ]
                  : [
                      'Small ciphertext lives in D1 (about 1.875 MB row cap); larger ciphertext goes to R2, default cap 10 MB.',
                      'Expired documents return a generic “does not exist” error; cleanup is lazy plus a Cron job. A failed R2 delete can leave orphaned ciphertext.',
                      'ctr/cbc documents are read-only compatibility and are not authenticated.',
                      'A malicious operator can serve modified JavaScript or retain a copy before burning. Zero knowledge protects data at rest, not a compromised client.',
                      'Burn + password: reading destroys the document even if the password is wrong.',
                      'No accounts, no password recovery, no data migration.',
                    ]
                ).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{zh ? '与 PrivateBin 的关系' : 'Relationship to PrivateBin'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                {zh
                  ? 'Binflare 源自 PrivateBin 社区项目，是面向 Cloudflare 的衍生重写版本，不是 PrivateBin 原项目。感谢 Sébastien Sauvage 与 PrivateBin 贡献者创造并维护了这套协议与上游实现。PrivateBin 使用 Zlib/libpng 许可证。'
                  : 'Binflare is a community rewrite derived from PrivateBin and is not the original PrivateBin project. Thanks to Sébastien Sauvage and the PrivateBin contributors for creating and maintaining the protocol and upstream implementation. PrivateBin is licensed under Zlib/libpng.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <a href={PROJECT.upstreamReleaseUrl} target="_blank" rel="noopener noreferrer">
                  {t('PrivateBin 2.1.0')} <ExternalLinkIcon />
                </a>
                <a href={PROJECT.noticeUrl} target="_blank" rel="noopener noreferrer">
                  {t('Attribution notice')} <ExternalLinkIcon />
                </a>
                <a href={PROJECT.parityDocsUrl} target="_blank" rel="noopener noreferrer">
                  {t('Compatibility matrix')} <ExternalLinkIcon />
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
