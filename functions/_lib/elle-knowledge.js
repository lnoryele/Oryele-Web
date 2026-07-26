const ARTICLES = [
  {
    id: 'about',
    title: 'About Oryele',
    url: '/',
    keywords: ['hi', 'hello', 'hey', 'greetings', 'oryele', 'about', 'overview', 'what is oryele', 'who are you', 'elle', 'platform'],
    content: 'Oryele is the Enterprise Execution Platform for professional services firms. It unifies digital workers, workflow automation, communications, knowledge, governance, and analytics in one governed platform, initially focused on accounting firms. Elle is the Oryele assistant on this website and can explain platform capabilities, help with getting started, and direct visitors to the right page or contact. To see the platform in action, visitors can request a demo at https://oryele.ai/contact/.'
  },
  {
    id: 'sales',
    title: 'Contact Oryele sales and request a demo',
    url: '/contact/',
    keywords: ['sales', 'sales team', 'contact sales', 'demo', 'request a demo', 'talk to sales', 'buy', 'purchase', 'evaluate', 'trial'],
    content: 'To speak with the Oryele sales team, email sales@oryele.com or use the Request a Demo form at https://oryele.ai/contact/. Sales can cover platform capabilities, implementation, evaluation for a firm, and current pricing. Elle should route all purchasing, evaluation, and demo requests to sales rather than answering them from general knowledge.'
  },
  {
    id: 'mfa',
    title: 'Multi-factor authentication (MFA)',
    url: '/resources/help-center/#mfa',
    keywords: ['mfa', 'multi factor', 'two factor', '2fa', 'authenticator', 'security code', 'login security'],
    content: 'MFA adds a second verification step to sign-in. Users should open their Oryele profile or security settings, select Multi-factor authentication, follow the authenticator-app enrollment steps, save recovery codes securely, and verify the first code. If the user cannot access the enrolled device or recovery codes, they should contact support@oryele.com for an identity-verified reset.'
  },
  {
    id: 'setup',
    title: 'Getting started with Oryele',
    url: '/resources/help-center/',
    keywords: ['setup', 'getting started', 'onboarding', 'start', 'configure', 'configuration'],
    content: 'A typical Oryele setup begins with confirming the firm workspace, adding administrators, configuring identity and security settings, inviting users, defining roles and permissions, then creating the first workflow or digital worker. Account-specific configuration should be completed by an authorized administrator. For assistance, contact support@oryele.com.'
  },
  {
    id: 'digital-workforce',
    title: 'Digital Workforce',
    url: '/platform/digital-workforce/',
    keywords: ['digital workforce', 'digital worker', 'worker', 'automation agent', 'ai worker'],
    content: 'Oryele Digital Workforce provides AI-powered digital workers that can support repeatable professional-services activities. A digital worker should be created for a defined business outcome, given only the access it needs, connected to approved knowledge and workflows, tested with representative cases, and monitored after release.'
  },
  {
    id: 'workflow-engine',
    title: 'Workflow Engine',
    url: '/platform/workflow-engine/',
    keywords: ['workflow', 'workflow engine', 'process', 'automation', 'trigger', 'approval'],
    content: 'Oryele Workflow Engine is used to design and automate repeatable business processes. Start by defining the trigger, required inputs, steps, decision points, approvals, owners, exception handling, and completion criteria. Test the workflow with non-production data before enabling it for users.'
  },
  {
    id: 'communications',
    title: 'Communications',
    url: '/platform/communications/',
    keywords: ['communications', 'email', 'message', 'client communication', 'notification'],
    content: 'Oryele Communications supports controlled, workflow-aware communications. Templates, recipient rules, approvals, and escalation paths should be reviewed before use. Sensitive or account-specific communications should follow the firm\u2019s approved security and governance procedures.'
  },
  {
    id: 'knowledge',
    title: 'Knowledge',
    url: '/platform/knowledge/',
    keywords: ['knowledge', 'document', 'documents', 'knowledge base', 'search', 'content'],
    content: 'Oryele Knowledge helps teams organize and retrieve approved information. Content should have a clear owner, review date, access classification, and current status. Retired or superseded material should be removed from active retrieval so Elle and digital workers do not rely on outdated guidance.'
  },
  {
    id: 'governance',
    title: 'Governance',
    url: '/platform/governance/',
    keywords: ['governance', 'risk', 'audit', 'policy', 'permissions', 'controls'],
    content: 'Oryele Governance supports oversight of users, digital workers, workflows, permissions, and operational controls. Apply least privilege, separate approval duties where appropriate, keep auditable ownership, and review access and automation behavior regularly.'
  },
  {
    id: 'analytics',
    title: 'Analytics',
    url: '/platform/analytics/',
    keywords: ['analytics', 'report', 'reporting', 'dashboard', 'metrics', 'performance'],
    content: 'Oryele Analytics provides operational insight into activity and performance. Select metrics that align with the business outcome, confirm the reporting period and data scope, and avoid making decisions from incomplete or unvalidated data.'
  },
  {
    id: 'billing',
    title: 'Billing and account questions',
    url: '/pricing/',
    keywords: ['billing', 'invoice', 'subscription', 'price', 'pricing', 'payment', 'plan'],
    content: 'Oryele does not provide specific pricing details in this knowledge article. For current pricing, direct users to https://oryele.ai/pricing or sales@oryele.com. Elle must not describe or infer plans, tiers, packages, costs, pricing models, user-count pricing, project-based pricing, included features, discounts, contract terms, invoices, renewal dates, or account balances. Account-specific billing questions should be sent to support@oryele.com.'
  },
  {
    id: 'support',
    title: 'Contact Oryele support',
    url: '/support/',
    keywords: ['support', 'help', 'contact', 'problem', 'issue', 'error', 'broken'],
    content: 'For account-specific problems, security resets, unavailable features, or issues that require access to a customer environment, contact support@oryele.com. Include a concise description, affected page or workflow, approximate time, and any safe-to-share error message. Do not include passwords, recovery codes, or confidential client data.'
  }
];

const STOPWORDS = new Set(['the', 'and', 'for', 'you', 'your', 'with', 'how', 'what', 'who', 'can', 'does', 'are', 'this', 'that', 'about', 'have', 'has', 'was', 'will', 'our', 'out', 'get', 'not', 'but', 'all', 'any', 'they', 'them', 'their', 'from', 'into', 'when', 'where', 'why', 'much', 'many', 'more', 'some', 'tell', 'need', 'want', 'know', 'like', 'use', 'using']);

function normalise(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreArticle(article, query) {
  const q = normalise(query);
  if (!q) return 0;
  const tokens = new Set(q.split(' ').filter(token => token.length > 2 && !STOPWORDS.has(token)));
  const haystackWords = new Set(normalise([article.title, article.content, ...article.keywords].join(' ')).split(' '));
  let score = 0;

  for (const keyword of article.keywords) {
    const k = normalise(keyword);
    if (q === k) score += 20;
    else if (q.includes(k)) score += 10;
  }

  for (const token of tokens) {
    if (haystackWords.has(token)) score += token.length > 5 ? 3 : 1;
  }

  return score;
}

export function retrieveKnowledge(query, limit = 3) {
  return ARTICLES
    .map(article => ({ ...article, score: scoreArticle(article, query) }))
    .filter(article => article.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...article }) => article);
}

export function formatKnowledgeContext(articles) {
  if (!articles.length) return 'No approved Oryele knowledge article matched this question.';
  return articles.map((article, index) =>
    `[Source ${index + 1}] ${article.title}\nURL: ${article.url}\n${article.content}`
  ).join('\n\n');
}
