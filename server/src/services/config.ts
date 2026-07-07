export const isProduction = process.env.NODE_ENV === 'production';

function isPlaceholder(value?: string) {
  return !value || value.trim() === '' || value.startsWith('replace-with-');
}

export function hasUsableDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl || process.env.VERIFUND_FORCE_MEMORY === '1') return false;

  try {
    const url = new URL(databaseUrl);
    return Boolean(url.hostname && url.protocol.startsWith('postgres'));
  } catch {
    return false;
  }
}

export function getAllowedCorsOrigins() {
  const configured = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured?.length) return configured;
  if (!isProduction) return ['http://localhost:5173', 'http://localhost:5174'];
  return [];
}

export function validateProductionConfig() {
  if (!isProduction) return;

  const missing: string[] = [];

  if (!hasUsableDatabaseUrl()) missing.push('DATABASE_URL');
  if (isPlaceholder(process.env.JWT_SECRET) || (process.env.JWT_SECRET?.length ?? 0) < 32) {
    missing.push('JWT_SECRET');
  }
  if (getAllowedCorsOrigins().length === 0) missing.push('CORS_ORIGIN');

  const nombaMockDisabled = process.env.NOMBA_ALLOW_MOCK_FALLBACK === 'false';
  const nombaConfigured =
    !isPlaceholder(process.env.NOMBA_CLIENT_ID) &&
    !isPlaceholder(process.env.NOMBA_CLIENT_SECRET) &&
    !isPlaceholder(process.env.NOMBA_ACCOUNT_ID) &&
    !isPlaceholder(process.env.NOMBA_WEBHOOK_SECRET);

  if (!nombaMockDisabled) missing.push('NOMBA_ALLOW_MOCK_FALLBACK=false');
  if (!nombaConfigured) {
    missing.push('NOMBA_CLIENT_ID');
    missing.push('NOMBA_CLIENT_SECRET');
    missing.push('NOMBA_ACCOUNT_ID');
    missing.push('NOMBA_WEBHOOK_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Production configuration is incomplete: ${[...new Set(missing)].join(', ')}`);
  }
}
