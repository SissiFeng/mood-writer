export function saveAsMarkdown(text: string, mood: string): string | null {
  if (!text.trim()) return null;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const filename = `mood-${dateStr}-${timeStr}-${mood}.md`;

  const frontmatter =
    `---\n` +
    `date: ${now.toISOString()}\n` +
    `mood: ${mood}\n` +
    `chars: ${text.length}\n` +
    `---\n\n`;

  const content = frontmatter + text + (text.endsWith('\n') ? '' : '\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
