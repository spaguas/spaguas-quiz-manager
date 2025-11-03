const parseUploadSizeMb = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const DEFAULT_MAX_UPLOAD_SIZE_MB = 10;

export const maxUploadSizeMb = parseUploadSizeMb(process.env.MAX_UPLOAD_SIZE_MB, DEFAULT_MAX_UPLOAD_SIZE_MB);
export const maxUploadSizeBytes = Math.floor(maxUploadSizeMb * 1024 * 1024);

const computedRequestLimitMb = Math.max(maxUploadSizeMb + 5, 15);
export const requestSizeLimit = process.env.REQUEST_SIZE_LIMIT || `${computedRequestLimitMb}mb`;

export const maxUploadSizeLabel = `${maxUploadSizeMb}MB`;
