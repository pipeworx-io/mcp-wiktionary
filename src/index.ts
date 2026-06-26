interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Wiktionary MCP — multilingual dictionary via Wikimedia REST + MediaWiki Action API
 *
 * Auth: none. Fair-use via meaningful User-Agent.
 * Docs: https://en.wiktionary.org/api/rest_v1/
 */


const UA = 'pipeworx-mcp-wiktionary/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'definition',
    description: 'Parsed definitions grouped by part-of-speech sections.',
    inputSchema: {
      type: 'object',
      properties: {
        word: { type: 'string' },
        lang: { type: 'string', description: 'Wiktionary subdomain (en | fr | de | ja | ...)' },
      },
      required: ['word'],
    },
  },
  {
    name: 'summary',
    description: 'Fetch the Wiktionary REST page summary (title, extract, thumbnail) for a word on the specified language subdomain (default en).',
    inputSchema: {
      type: 'object',
      properties: {
        word: { type: 'string' },
        lang: { type: 'string' },
      },
      required: ['word'],
    },
  },
  {
    name: 'search',
    description: 'Wiktionary title + fulltext search.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        lang: { type: 'string' },
        limit: { type: 'number', description: '1-50 (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'etymology',
    description: 'Etymology section extracted from wikitext.',
    inputSchema: {
      type: 'object',
      properties: {
        word: { type: 'string' },
        lang: { type: 'string' },
      },
      required: ['word'],
    },
  },
  {
    name: 'pronunciations',
    description: 'IPA / phonetic transcriptions extracted from wikitext.',
    inputSchema: {
      type: 'object',
      properties: {
        word: { type: 'string' },
        lang: { type: 'string' },
      },
      required: ['word'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const lang = ((args.lang as string) ?? 'en').toLowerCase();
  const word = reqStr(args, name === 'search' ? 'query' : 'word', '"word"');
  switch (name) {
    case 'definition':
      return wikiRest(lang, `/page/definition/${encodeURIComponent(word)}`);
    case 'summary':
      return wikiRest(lang, `/page/summary/${encodeURIComponent(word)}`);
    case 'search':
      return wikiAction(lang, {
        action: 'opensearch',
        search: word,
        limit: String(Math.min(50, Math.max(1, (args.limit as number) ?? 10))),
        namespace: '0',
        format: 'json',
        formatversion: '2',
      });
    case 'etymology':
      return extractSection(lang, word, /etymology/i);
    case 'pronunciations':
      return extractSection(lang, word, /pronunciation/i);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// SSRF guard: `lang` is caller-supplied and interpolated into the host, so a
// value like "evil.com/" would point the fetch at evil.com. Wiktionary language
// codes are bare labels (en, zh-yue, …).
function assertLang(lang: string): void {
  if (!/^[a-z0-9-]{1,32}$/i.test(lang)) throw new Error(`Wiktionary: invalid lang "${lang}".`);
}

async function wikiRest(lang: string, path: string) {
  assertLang(lang);
  const url = `https://${lang}.wiktionary.org/api/rest_v1${path}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404) throw new Error(`Wiktionary: page not found`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Wiktionary error: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function wikiAction(lang: string, params: Record<string, string>) {
  assertLang(lang);
  const url = `https://${lang}.wiktionary.org/w/api.php?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Wiktionary error: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function extractSection(lang: string, word: string, sectionRe: RegExp) {
  // Walk the page-section list via Action API, find a section whose line matches `sectionRe`,
  // then fetch just that section's wikitext.
  const sectionsResp = (await wikiAction(lang, {
    action: 'parse',
    page: word,
    prop: 'sections',
    format: 'json',
    formatversion: '2',
  })) as { parse?: { sections?: { line: string; number: string; index: string; level: string }[] } };

  const sections = sectionsResp.parse?.sections ?? [];
  const match = sections.find((s) => sectionRe.test(s.line));
  if (!match) {
    return { word, found: false, available_sections: sections.map((s) => s.line) };
  }

  const wtResp = (await wikiAction(lang, {
    action: 'parse',
    page: word,
    section: match.index,
    prop: 'wikitext',
    format: 'json',
    formatversion: '2',
  })) as { parse?: { wikitext?: string } };

  return {
    word,
    section: match.line,
    section_number: match.number,
    wikitext: wtResp.parse?.wikitext ?? null,
  };
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  }
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
