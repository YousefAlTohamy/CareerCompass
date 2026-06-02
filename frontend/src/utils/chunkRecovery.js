export const CHUNK_RELOAD_ATTEMPTED_KEY = 'careercompass:chunk-reload-attempted';
const WINDOW_NAME_MARKER = '[careercompass:chunk-reload-attempted]';

const CHUNK_LOAD_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk/i,
  /ChunkLoadError/i,
];

const getStorageTargets = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  return [window.sessionStorage, window.localStorage].filter(Boolean);
};

export const isChunkLoadError = (error) => {
  const errorText = [
    typeof error === 'string' ? error : '',
    error?.name,
    error?.message,
    error?.stack,
  ]
    .filter(Boolean)
    .join('\n');

  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(errorText));
};

export const hasChunkReloadAttempted = () => getStorageTargets().some((storage) => {
  try {
    return storage.getItem(CHUNK_RELOAD_ATTEMPTED_KEY) === 'true';
  } catch (error) {
    console.warn('Unable to read chunk recovery marker:', error);
    return false;
  }
}) || (
  typeof window !== 'undefined'
  && typeof window.name === 'string'
  && window.name.includes(WINDOW_NAME_MARKER)
);

export const markChunkReloadAttempted = () => {
  const timestamp = String(Date.now());

  getStorageTargets().forEach((storage) => {
    try {
      storage.setItem(CHUNK_RELOAD_ATTEMPTED_KEY, 'true');
      storage.setItem(`${CHUNK_RELOAD_ATTEMPTED_KEY}:timestamp`, timestamp);
    } catch (error) {
      console.warn('Unable to write chunk recovery marker:', error);
    }
  });

  if (typeof window !== 'undefined' && typeof window.name === 'string' && !window.name.includes(WINDOW_NAME_MARKER)) {
    window.name = `${window.name || ''}${WINDOW_NAME_MARKER}`;
  }
};

export const clearChunkReloadAttempt = () => {
  getStorageTargets().forEach((storage) => {
    try {
      storage.removeItem(CHUNK_RELOAD_ATTEMPTED_KEY);
      storage.removeItem(`${CHUNK_RELOAD_ATTEMPTED_KEY}:timestamp`);
    } catch (error) {
      console.warn('Unable to clear chunk recovery marker:', error);
    }
  });

  if (typeof window !== 'undefined' && typeof window.name === 'string') {
    window.name = window.name.replace(WINDOW_NAME_MARKER, '');
  }
};
