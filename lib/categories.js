const EXACT = new Map([
  ['github.com', 'Development'], ['gitlab.com', 'Development'], ['stackoverflow.com', 'Development'],
  ['developer.mozilla.org', 'Development'], ['npmjs.com', 'Development'], ['vercel.com', 'Development'],
  ['netlify.com', 'Development'], ['codepen.io', 'Development'], ['replit.com', 'Development'],
  ['youtube.com', 'Entertainment'], ['youtu.be', 'Entertainment'], ['twitch.tv', 'Entertainment'],
  ['netflix.com', 'Entertainment'], ['hulu.com', 'Entertainment'], ['disneyplus.com', 'Entertainment'],
  ['reddit.com', 'Social'], ['x.com', 'Social'], ['twitter.com', 'Social'], ['instagram.com', 'Social'],
  ['facebook.com', 'Social'], ['discord.com', 'Social'], ['linkedin.com', 'Social'], ['threads.net', 'Social'],
  ['wikipedia.org', 'Learning'], ['khanacademy.org', 'Learning'], ['coursera.org', 'Learning'],
  ['edx.org', 'Learning'], ['quizlet.com', 'Learning'], ['duolingo.com', 'Learning'],
  ['google.com', 'Search'], ['bing.com', 'Search'], ['duckduckgo.com', 'Search'], ['perplexity.ai', 'Search'],
  ['amazon.com', 'Shopping'], ['ebay.com', 'Shopping'], ['walmart.com', 'Shopping'], ['etsy.com', 'Shopping'],
  ['nytimes.com', 'News'], ['cnn.com', 'News'], ['bbc.com', 'News'], ['reuters.com', 'News'],
  ['docs.google.com', 'Work'], ['drive.google.com', 'Work'], ['notion.so', 'Work'], ['figma.com', 'Work'],
  ['slack.com', 'Work'], ['teams.microsoft.com', 'Work'], ['office.com', 'Work']
]);

const KEYWORDS = [
  ['Development', ['dev.', 'docs.', 'api.', 'code', 'github', 'gitlab', 'stack', 'npm', 'vercel']],
  ['Entertainment', ['video', 'music', 'stream', 'movie', 'gaming', 'game']],
  ['Social', ['social', 'forum', 'community', 'chat']],
  ['Learning', ['learn', 'course', 'school', 'edu', 'wiki']],
  ['Shopping', ['shop', 'store', 'market']],
  ['News', ['news', 'times', 'post', 'journal']],
  ['Work', ['work', 'docs', 'drive', 'office', 'project']]
];

export function normalizeDomain(hostname = '') {
  return hostname.toLowerCase().replace(/^www\./, '');
}

export function categorizeDomain(domain = '') {
  const d = normalizeDomain(domain);
  if (!d) return 'Other';
  if (EXACT.has(d)) return EXACT.get(d);
  for (const [known, category] of EXACT.entries()) {
    if (d.endsWith(`.${known}`)) return category;
  }
  for (const [category, words] of KEYWORDS) {
    if (words.some((word) => d.includes(word))) return category;
  }
  return 'Other';
}
