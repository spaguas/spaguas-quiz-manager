const rawBasePath = process.env.APP_BASE_PATH?.trim() ?? '';

let basePath = rawBasePath;
if (basePath !== '') {
  basePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  basePath = basePath.replace(/\/+$/, '');
}

let publicUrl = process.env.APP_PUBLIC_URL?.trim() ?? '';
if (publicUrl) {
  publicUrl = publicUrl.replace(/\/+$/, '');
}

export default {
  basePath,
  publicUrl,
};
