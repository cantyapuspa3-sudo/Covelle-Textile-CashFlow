import fs from 'node:fs';

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
      })
      .filter(([key]) => key)
  );
}

const env = { ...loadEnv('.env'), ...process.env };
const projectUrl = (process.argv[2] || env.SUPABASE_URL || '').replace(/\/$/, '');
const secretKey = env.SUPABASE_SECRET;

if (!projectUrl || !secretKey) {
  console.error('Tes Supabase tidak dapat dimulai.');
  if (!projectUrl) console.error('SUPABASE_URL belum ada. Jalankan: node test-supabase.mjs https://<project-ref>.supabase.co');
  if (!secretKey) console.error('SUPABASE_SECRET belum ada di .env.');
  process.exit(1);
}

try {
  const response = await fetch(`${projectUrl}/auth/v1/settings`, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    console.error(`Supabase terjangkau, tetapi autentikasi gagal: HTTP ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  console.log(`Koneksi Supabase berhasil: ${projectUrl}`);
} catch (error) {
  console.error(`Koneksi Supabase gagal: ${error.message}`);
  process.exit(1);
}