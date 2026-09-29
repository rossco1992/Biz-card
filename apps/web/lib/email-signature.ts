import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";
export const MAX_SIGNATURE_BYTES = 100 * 1024;
const size = /^(?:0|\d{1,4}(?:\.\d+)?(?:px|pt|em|rem|%))$/;
const color = /^(?:#[a-f\d]{3,8}|[a-z]{1,20}|rgba?\([\d\s.,%]+\))$/i;
export function sanitizeSignature(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['div','p','span','br','strong','b','em','i','u','s','a','img','table','tbody','thead','tfoot','tr','td','th','hr','ul','ol','li','font'],
    allowedAttributes: { '*': ['style'], a: ['href','title'], img: ['src','alt','width','height'], table: ['width','cellpadding','cellspacing','border'], td: ['width','height','colspan','rowspan','align','valign'], th: ['colspan','rowspan','align'], font: ['color','face','size'] },
    allowedSchemes: ['https','http','mailto','tel'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    allowedStyles: { '*': {
      color: [color], 'background-color': [color], 'font-size': [size],
      'font-family': [/^[a-z\d\s,'"-]+$/i], 'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/], 'text-decoration': [/^(none|underline|line-through)$/],
      'text-align': [/^(left|right|center|justify)$/], 'vertical-align': [/^(top|middle|bottom|baseline)$/],
      width: [size], height: [size], 'max-width': [size], 'line-height': [size,/^\d(?:\.\d+)?$/],
      padding: [/^[\d.\s]+(?:px|pt)$/], margin: [/^[\d.\s]+(?:px|pt)$/],
      'border-collapse': [/^(collapse|separate)$/],
      border: [/^\d{1,2}px (solid|dotted|dashed) #[a-f\d]{3,8}$/i],
    } },
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
  }).trim();
}
export function importSignature(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Choose an HTML signature file.');
  if (Buffer.byteLength(raw) > MAX_SIGNATURE_BYTES) throw new Error('Choose an HTML file smaller than 100 KB.');
  const html = sanitizeSignature(raw);
  const text = convert(html, { wordwrap: false }).trim();
  if (!text && !html.includes('<img')) throw new Error('This file has no usable signature content.');
  const warnings = /(?:src\s*=\s*["']?(?:file:|cid:|data:|\.\.?\/)|src\s*=\s*["'][^"':]*["'])/i.test(raw)
    ? ['Some images use local or embedded files. Replace them with publicly hosted HTTPS images in your HTML file.'] : [];
  return { html, text, warnings };
}
export function renderSignedEmail(body: string, plain: string, rich?: string | null, include = true) {
  const signature = include && rich ? sanitizeSignature(rich) : '';
  const fallback = signature ? convert(signature, { wordwrap: false }).trim() : include ? plain.trim() : '';
  const text = [body.trim(), fallback].filter(Boolean).join('\n\n');
  const escaped = body.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r?\n/g,'<br>');
  return { text, html: signature ? `<div>${escaped}</div><br><br>${signature}` : null };
}
