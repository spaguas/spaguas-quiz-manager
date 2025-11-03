const normalizeBasePath = (value) => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }

  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
};

const envBasePath = process.env.APP_BASE_PATH ?? '';
let basePath = normalizeBasePath(envBasePath);

if (!basePath) {
  basePath = '/quiz';
}

let publicUrl = process.env.APP_PUBLIC_URL?.trim() ?? '';
if (publicUrl) {
  publicUrl = publicUrl.replace(/\/+$/, '');
}

export default {
  basePath,
  publicUrl,
};
