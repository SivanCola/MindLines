export const TEXT_ATTACHMENT_MAX_COUNT = 6;
export const TEXT_ATTACHMENT_MAX_BYTES = 256 * 1024;
export const TEXT_ATTACHMENT_MAX_TOTAL_BYTES = 512 * 1024;

export const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  '.asm',
  '.bat',
  '.c',
  '.cc',
  '.cs',
  '.csproj',
  '.conf',
  '.cpp',
  '.css',
  '.csv',
  '.cxx',
  '.dart',
  '.diff',
  '.el',
  '.ex',
  '.exs',
  '.go',
  '.gradle',
  '.graphql',
  '.groovy',
  '.h',
  '.hcl',
  '.hh',
  '.hpp',
  '.htm',
  '.html',
  '.ini',
  '.ipynb',
  '.java',
  '.js',
  '.json',
  '.json5',
  '.jsonl',
  '.jsx',
  '.kt',
  '.less',
  '.log',
  '.lock',
  '.lua',
  '.mjs',
  '.patch',
  '.php',
  '.pl',
  '.properties',
  '.proto',
  '.py',
  '.r',
  '.rb',
  '.rs',
  '.rst',
  '.sass',
  '.scala',
  '.scss',
  '.sh',
  '.sql',
  '.srt',
  '.swift',
  '.svelte',
  '.toml',
  '.ts',
  '.tsv',
  '.tsx',
  '.txt',
  '.vcf',
  '.vtt',
  '.xml',
  '.yaml',
  '.yml',
  '.vue',
  '.zsh',
  '.md',
  '.markdown'
]);

export const TEXT_ATTACHMENT_FILENAMES = new Set([
  'brewfile',
  'dockerfile',
  'gemfile',
  'license',
  'makefile',
  'procfile',
  'rakefile',
  'readme'
]);

export const TEXT_ATTACHMENT_BLOCKED_EXTENSIONS = new Set([
  '.7z',
  '.app',
  '.avi',
  '.bin',
  '.bmp',
  '.db',
  '.dmg',
  '.doc',
  '.docx',
  '.exe',
  '.gif',
  '.gz',
  '.heic',
  '.jpeg',
  '.jpg',
  '.key',
  '.mov',
  '.mp3',
  '.mp4',
  '.numbers',
  '.odp',
  '.ods',
  '.odt',
  '.pages',
  '.parquet',
  '.pdf',
  '.png',
  '.ppt',
  '.pptx',
  '.rar',
  '.rtf',
  '.sqlite',
  '.tar',
  '.tiff',
  '.wasm',
  '.webp',
  '.xls',
  '.xlsx',
  '.zip'
]);

export const TEXT_ATTACHMENT_MEDIA_TYPES = new Set([
  'application/csv',
  'application/graphql',
  'application/javascript',
  'application/json',
  'application/json5',
  'application/toml',
  'application/typescript',
  'application/x-ndjson',
  'application/x-yaml',
  'application/yaml',
  'application/xml',
  'text/calendar',
  'text/css',
  'text/csv',
  'text/html',
  'text/javascript',
  'text/jsx',
  'text/markdown',
  'text/plain',
  'text/tsx',
  'text/tsv',
  'text/vtt',
  'text/xml',
  'text/x-c',
  'text/x-c++',
  'text/x-csharp',
  'text/x-diff',
  'text/x-go',
  'text/x-java',
  'text/x-kotlin',
  'text/x-python',
  'text/x-ruby',
  'text/x-rust',
  'text/x-sh',
  'text/x-sql',
  'text/x-swift',
  'text/x-toml',
  'text/x-typescript',
  'text/x-yaml',
  'text/x-zsh'
]);

export const TEXT_ATTACHMENT_BLOCKED_MEDIA_TYPES = new Set([
  'application/gzip',
  'application/msword',
  'application/pdf',
  'application/rtf',
  'application/vnd.apple.keynote',
  'application/vnd.apple.numbers',
  'application/vnd.apple.pages',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-7z-compressed',
  'application/x-apple-diskimage',
  'application/x-rar-compressed',
  'application/x-sqlite3',
  'application/x-tar',
  'application/zip'
]);

export const TEXT_ATTACHMENT_ACCEPT = [
  ...TEXT_ATTACHMENT_EXTENSIONS,
  ...TEXT_ATTACHMENT_MEDIA_TYPES
].join(',');

export function textAttachmentExtension(fileName: string): string {
  const cleanName = fileName.trim().toLowerCase();
  const dotIndex = cleanName.lastIndexOf('.');
  return dotIndex > 0 ? cleanName.slice(dotIndex) : '';
}

export function textAttachmentBaseName(fileName: string): string {
  return fileName.trim().toLowerCase().split(/[\\/]/).pop() ?? '';
}

export function isSensitiveTextAttachmentName(fileName: string): boolean {
  const cleanName = textAttachmentBaseName(fileName);
  return cleanName === '.env' || cleanName.startsWith('.env.') || cleanName === '.npmrc' || cleanName === '.pypirc' || cleanName === '.netrc';
}

export function isSupportedTextAttachment(fileName: string, mediaType: string): boolean {
  if (isSensitiveTextAttachmentName(fileName)) {
    return false;
  }
  const normalizedMediaType = mediaType.trim().toLowerCase();
  if (
    TEXT_ATTACHMENT_BLOCKED_MEDIA_TYPES.has(normalizedMediaType) ||
    normalizedMediaType.startsWith('audio/') ||
    normalizedMediaType.startsWith('video/') ||
    normalizedMediaType.startsWith('image/')
  ) {
    return false;
  }
  const baseName = textAttachmentBaseName(fileName);
  if (TEXT_ATTACHMENT_FILENAMES.has(baseName)) {
    return true;
  }
  const extension = textAttachmentExtension(fileName);
  if (extension) {
    if (TEXT_ATTACHMENT_BLOCKED_EXTENSIONS.has(extension)) {
      return false;
    }
    return TEXT_ATTACHMENT_EXTENSIONS.has(extension);
  }
  if (normalizedMediaType === 'application/octet-stream') {
    return false;
  }
  return TEXT_ATTACHMENT_MEDIA_TYPES.has(normalizedMediaType) || normalizedMediaType.startsWith('text/');
}

export function looksLikeUtf8Text(text: string): boolean {
  if (text.includes('\0')) {
    return false;
  }
  if (!text) {
    return true;
  }
  const replacementCount = [...text].filter((char) => char === '\uFFFD').length;
  return replacementCount / text.length < 0.01;
}
