import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Language = 'en' | 'zh'

const zh: Record<string, string> = {
  About: '关于',
  'New document': '新建文档',
  'Decrypting locally…': '正在本地解密…',
  'Read once, then it is gone.': '只能读一次，读后即毁。',
  'Opening this document deletes it on the server. There is no second chance and no recovery.':
    '打开文档会在服务端删除它。没有第二次机会，也无法恢复。',
  'Read and destroy': '读取并销毁',
  Cancel: '取消',
  'Document unavailable': '文档不可用',
  'Unable to open': '无法打开',
  'Create a new document': '新建文档',
  'Document created.': '文档已创建。',
  'Copy the link now; the delete link is shown only in this session.':
    '现在复制链接；删除链接只在本次会话中显示。',
  'Copy link': '复制链接',
  'Delete this document': '删除此文档',
  'The delete link contains a secret token. Anyone with it can delete the document.':
    '删除链接含有一个密钥令牌，任何拿到它的人都能删除文档。',
  'This burn-after-reading document was destroyed after it was read. Reloading the link will not recover it.':
    '这份阅后即焚文档已在读取后销毁，刷新链接也无法恢复。',
  'This legacy document uses': '这份旧格式文档使用',
  'which is not authenticated. It is read-only for compatibility; Binflare always creates AES-GCM documents.':
    '，它没有认证。仅作兼容读取；Binflare 新建始终使用 AES-GCM。',
  'Shared document': '共享文档',
  Document: '文档',
  'Burn after reading': '阅后即焚',
  'No expiry': '不过期',
  'Open discussion': '开放讨论',
  Destroyed: '已销毁',
  'Copy text': '复制正文',
  Download: '下载',
  'Raw text': '原始文本',
  Email: '邮件',
  'QR code': '二维码',
  Clone: '克隆',
  New: '新建',
  'Link copied.': '链接已复制。',
  'Document copied.': '正文已复制。',
  'Could not copy. Select the text manually.': '复制失败，请手动选择文本。',
  'Could not generate the QR code.': '无法生成二维码。',
  Attachments: '附件',
  'Preview is disabled for this file type. Download it to view it.':
    '此文件类型不提供预览，请下载后查看。',
  'Version chain': '版本链',
  'Plain text': '纯文本',
  'Raw document': '原始文档',
  Close: '关闭',
  Dismiss: '关闭对话框',
  'This QR code contains the decryption key. Anyone who can see or scan it can read the document.':
    '二维码包含解密密钥，任何看到或扫描它的人都能读取文档。',
  'This page decrypted the document locally. The server only stored ciphertext.':
    '本页在本地解密。服务端只保存了密文。',
  'This link is missing its decryption key (#fragment). Open the complete original link.':
    '链接缺少解密密钥（#fragment）。请打开完整的原始链接。',
  'Wrong password. Try again.': '口令错误，请重试。',
  'The document was destroyed, but the password was wrong or the document was corrupted.':
    '文档已销毁，但口令错误或文档已损坏。',
  'The document was destroyed. It may have required a password.':
    '文档已销毁；它可能需要口令。',
  'Password required': '需要口令',
  'Password (if set)': '口令（如有）',
  'This document was encrypted with a password. The server cannot verify or recover it.':
    '这份文档使用了口令加密。服务端无法验证或找回口令。',
  'Enter the password if one was set. Reading destroys the document, even if the password is wrong.':
    '如果设置了口令，请在这里输入。读取会销毁文档，即使口令错误。',
  Password: '口令',
  Unlock: '解锁',
  'Working…': '处理中…',
  'The password is never sent to the server.': '口令不会发送到服务端。',
  'Protected document': '受保护文档',
  'Write it. Encrypt it. Share the link.': '写下它，加密它，分享链接。',
  'Zero-knowledge paste': '零知识粘贴',
  'Encryption happens in this browser. The key stays in the URL fragment and never reaches the server.':
    '加密在此浏览器中完成。密钥只留在 URL fragment，不会到达服务端。',
  'Cloning an existing document. Text, format and attachments are copied into this editor; password, expiry and burn settings are reset.':
    '正在克隆现有文档。正文、格式和附件会复制到编辑器；口令、过期和焚毁设置会重置。',
  Editor: '编辑',
  Preview: '预览',
  'text+files': '正文+文件',
  'ciphertext ≤': '密文 ≤',
  'Paste or type something worth keeping private…': '粘贴或输入值得保密的内容…',
  Expires: '过期',
  Format: '格式',
  'Password (optional)': '口令（可选）',
  'No password': '无口令',
  Show: '显示',
  Hide: '隐藏',
  'Attach files': '添加附件',
  'Or drag and drop / paste files. Files are encrypted inside the document.':
    '或拖放/粘贴文件。文件会加密在文档内。',
  Remove: '移除',
  'Attachments:': '附件：',
  'before encryption.': '（加密前）。',
  'The password cannot be recovered. The recipient needs both the link and the password.':
    '口令无法找回。接收者需要同时拿到链接和口令。',
  'A burn link is prefixed with': '阅后即焚链接带有',
  '. Opening it destroys the paste after one read. Send it only when the recipient is ready.':
    ' 前缀。打开后只能读一次，随后销毁。请确认接收者准备好后再发送。',
  'Encrypting…': '加密中…',
  'Create paste': '创建粘贴',
  '⌘/Ctrl + S to submit': '⌘/Ctrl + S 提交',
  'Drop files to attach': '松开以添加附件',
  'Nothing to preview yet.': '还没有可预览的内容。',
  'Attachments are included; add text if you want a preview.': '已包含附件；如需预览请添加正文。',
  'Could not read': '无法读取',
  'Supports PrivateBin v2 pastes, comments and delete links. A Cloudflare rewrite derived from PrivateBin.':
    '支持 PrivateBin v2 粘贴、评论和删除链接。源自 PrivateBin 的 Cloudflare 重写。',
  Discussion: '讨论',
  'No comments yet.': '还没有评论。',
  'Nickname (optional)': '昵称（可选）',
  Comment: '评论',
  'Write a comment…': '写一条评论…',
  'Post comment': '发表评论',
  'Posting…': '发表中…',
  'Close reply': '关闭回复',
  Reply: '回复',
  Anonymous: '匿名',
  '[Unable to decrypt this comment]': '[无法解密这条评论]',
  'comment': '条评论',
  'comments': '条评论',
  'Expires in': '剩余',
  'Dark mode': '暗色模式',
  'Light mode': '亮色模式',
  'Language': '语言',
  'A Cloudflare rewrite derived from PrivateBin.': '源自 PrivateBin 的 Cloudflare 重写。',
  'Protocol-compatible with PrivateBin 2.1.0.': '与 PrivateBin 2.1.0 协议兼容。',
  'About Binflare': '关于 Binflare',
  'Back to editor': '返回编辑器',
  'View on GitHub': '在 GitHub 查看',
  'Upstream PrivateBin': '上游 PrivateBin',
  'Protocol baseline': '协议基线',
  'PrivateBin 2.1.0': 'PrivateBin 2.1.0',
  'Attribution notice': '致谢声明',
  'Compatibility matrix': '兼容性矩阵',
  'Protocol compatibility': '协议兼容性',
  'Deployment status': '部署状态',
  'This page only reads the runtime configuration. It does not change Cloudflare resources.':
    '本页只读取运行时配置，不会修改 Cloudflare 资源。',
  'Capability check': '能力检查',
  'Values come from the deployed Worker, not from a hard-coded template.':
    '状态来自已部署的 Worker，而不是写死的模板。',
  'Could not read the runtime configuration.': '无法读取运行时配置。',
  Ready: '已就绪',
  Refresh: '刷新',
  Checking: '检查中',
  'Checking...': '正在检查…',
  Detected: '已检测',
  'Manual check': '需人工确认',
  'D1 database': 'D1 数据库',
  'Ready. The schema is initialized on the first API request.':
    '已就绪。首次 API 请求会自动初始化数据表。',
  'Large pastes and attachments': '大文本与附件',
  Enabled: '已启用',
  'Not enabled': '未启用',
  'Enabled. The current deployment accepts ciphertext up to the configured R2 limit.':
    '已启用。当前部署可接受达到 R2 配置上限的密文。',
  'Not enabled. Short text and code snippets work; the current deployment cap is about 1.8 MB.':
    '未启用。短文本和代码片段可正常使用；当前部署上限约 1.8 MB。',
  'Enable R2 in the Cloudflare dashboard and create the bucket used by this deployment.':
    '请先在 Cloudflare 控制台开通 R2，并创建本次部署使用的对象桶。',
  'Redeploy the Worker once so Cloudflare attaches the R2 bucket.':
    '然后重新部署一次 Worker，让 Cloudflare 关联这个对象桶。',
  'Return here and refresh. This page turns green when the Worker sees the R2 binding.':
    '回到本页刷新。Worker 识别到对象桶后，这里就会变绿。',
  'Effective ciphertext limit': '当前密文上限',
  'D1-only tier': 'D1 档',
  'R2 lifecycle rule': 'R2 生命周期规则',
  'The Worker cannot verify this rule from its runtime binding. Confirm it exists in the Cloudflare dashboard.':
    'Worker 无法通过运行时绑定检查这条规则，请到 Cloudflare 控制台确认它已存在。',
  'Open R2 dashboard': '打开 R2 控制台',
  'Lifecycle guide': '生命周期教程',
  'The D1 and R2 tiers are capabilities of the same deployment, not separate products.':
    'D1 档和 R2 档是同一部署的两个能力，不是两个产品。',
  Source: '源码',
  License: '许可证',
  Share: '分享',
  Markdown: 'Markdown',
  Code: '代码',
  Text: '文本',
  'Encrypted document': '加密文档',
  'Something went wrong.': '出了点问题。',
  'Hide password': '隐藏口令',
  'Show password': '显示口令',
  '5 minutes': '5 分钟',
  '10 minutes': '10 分钟',
  '1 hour': '1 小时',
  '1 day': '1 天',
  '1 week': '1 周',
  '1 month': '1 个月',
  '1 year': '1 年',
  Never: '不过期',
  'Document does not exist, has expired or has been deleted.':
    '文档不存在、已过期或已被删除。',
  'Invalid data.': '数据无效。',
  'Wrong deletion token. Document was not deleted.': '删除令牌错误，文档未删除。',
  'Could not reach the server.': '无法连接服务端。',
  'The document is too large.': '文档太大。',
  'Current deployment cap: about 1.8 MB, enough for short text and code snippets. Enable R2 to raise it to 10 MB for large text and attachments.':
    '当前部署上限约 1.8 MB，适合短文本和代码片段；开通 R2 后可提升到 10 MB，支持大文本和附件。',
  'The encrypted document is larger than this deployment allows.':
    '加密后的文档超过当前部署允许的大小。',
  'Please wait {seconds} seconds between each post.': '请等待 {seconds} 秒后再发送。',
  'This site requires HTTPS. WebCrypto is unavailable in an insecure context.':
    '本站需要 HTTPS。在非安全上下文中 WebCrypto 不可用。',
  'Could not post the comment.': '无法发表评论。',
  'Large-paste storage is not configured.': '未配置大附件存储。',
  'Could not save the document.': '无法保存文档。',
}

const en = {} as Record<string, string>

interface I18nValue {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')

  useEffect(() => {
    let initial: Language = 'en'
    try {
      const stored = window.localStorage.getItem('binflare.lang')
      if (stored === 'en' || stored === 'zh') {
        initial = stored
      } else if (window.navigator.language.toLowerCase().startsWith('zh')) {
        initial = 'zh'
      }
    } catch {
      // localStorage may be unavailable
    }
    setLangState(initial)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  function setLang(next: Language) {
    setLangState(next)
    try {
      window.localStorage.setItem('binflare.lang', next)
    } catch {
      // ignore
    }
  }

  const value = useMemo<I18nValue>(() => {
    const dictionary = lang === 'zh' ? zh : en
    return {
      lang,
      setLang,
      t: (key, vars) => {
        let text = dictionary[key] ?? key
        if (vars) {
          for (const [name, replacement] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(replacement))
          }
        }
        return text
      },
    }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider')
  }
  return value
}
