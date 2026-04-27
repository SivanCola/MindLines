import { describe, expect, it } from 'vitest';
import { isSupportedTextAttachment } from '../src/shared/attachmentPolicy';

describe('text attachment policy', () => {
  it('allows common UTF-8 text, data, and code formats', () => {
    expect(isSupportedTextAttachment('notes.md', 'text/markdown')).toBe(true);
    expect(isSupportedTextAttachment('data.csv', 'text/csv')).toBe(true);
    expect(isSupportedTextAttachment('config.yaml', 'application/x-yaml')).toBe(true);
    expect(isSupportedTextAttachment('component.vue', '')).toBe(true);
    expect(isSupportedTextAttachment('Dockerfile', '')).toBe(true);
  });

  it('blocks document, binary, media, and secret config formats', () => {
    expect(isSupportedTextAttachment('report.pdf', 'application/pdf')).toBe(false);
    expect(isSupportedTextAttachment('brief.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
    expect(isSupportedTextAttachment('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(false);
    expect(isSupportedTextAttachment('archive.zip', 'application/zip')).toBe(false);
    expect(isSupportedTextAttachment('image.png', 'image/png')).toBe(false);
    expect(isSupportedTextAttachment('.env', 'text/plain')).toBe(false);
  });
});
