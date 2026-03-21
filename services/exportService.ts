import { Message, StoryConfig, AppLanguage } from '../types';

// ============================================================
// Export Service — TXT, HTML (Word-compatible), PDF (print)
// ============================================================

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function extractStoryContent(messages: Message[]): string {
  return messages
    .filter(m => m.role === 'assistant')
    .map(m => {
      // Strip JSON analysis blocks
      let content = m.content;
      content = content.replace(/```json[\s\S]*?```/g, '').trim();
      return content;
    })
    .join('\n\n---\n\n');
}

// --- TXT Export ---
export function exportAsTXT(
  messages: Message[],
  config: StoryConfig,
): void {
  const header = `${config.title}\nGenre: ${config.genre} | POV: ${config.povCharacter}\n${'='.repeat(50)}\n\n`;
  const content = header + extractStoryContent(messages);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${config.title || 'story'}.txt`);
}

// --- HTML Export (Word-compatible) ---
export function exportAsHTML(
  messages: Message[],
  config: StoryConfig,
): void {
  const storyContent = extractStoryContent(messages);
  const paragraphs = storyContent.split('\n').map(p => {
    if (p.trim() === '---') return '<hr/>';
    if (p.trim() === '') return '';
    return `<p>${p}</p>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${config.title || 'Story'}</title>
<style>
  body { font-family: 'Noto Sans KR', 'Batang', serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; font-size: 14px; color: #222; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .meta { color: #888; font-size: 12px; margin-bottom: 40px; }
  p { text-indent: 1em; margin: 0.5em 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
</style>
</head>
<body>
<h1>${config.title || 'Untitled'}</h1>
<div class="meta">${config.genre} | ${config.povCharacter} | EP.${config.episode}</div>
${paragraphs}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${config.title || 'story'}.html`);
}

// --- PDF Export (via browser print) ---
export function exportAsPDF(
  messages: Message[],
  config: StoryConfig,
): void {
  const storyContent = extractStoryContent(messages);
  const paragraphs = storyContent.split('\n').map(p => {
    if (p.trim() === '---') return '<hr/>';
    if (p.trim() === '') return '';
    return `<p>${p}</p>`;
  }).join('\n');

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${config.title || 'Story'}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: 'Noto Sans KR', 'Batang', serif; line-height: 1.8; font-size: 12pt; color: #000; }
  h1 { font-size: 18pt; margin-bottom: 4px; }
  .meta { color: #666; font-size: 10pt; margin-bottom: 30px; }
  p { text-indent: 1em; margin: 0.4em 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
</style>
</head>
<body>
<h1>${config.title || 'Untitled'}</h1>
<div class="meta">${config.genre} | ${config.povCharacter} | EP.${config.episode}</div>
${paragraphs}
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
  printWindow.document.close();
}

// --- Session JSON Export ---
export function exportSessionJSON(session: {
  id: string;
  title: string;
  messages: Message[];
  config: StoryConfig;
  lastUpdate: number;
  [key: string]: any;
}): void {
  const data = JSON.stringify(session, null, 2);
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${session.title || 'session'}_backup.json`);
}

// --- Session JSON Import ---
export function importSessionJSON(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.messages || !data.config) {
          reject(new Error('Invalid session file: missing messages or config'));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}
