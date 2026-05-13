const serializeError = (error) => {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
};

const emit = (level, message, meta = {}) => {
  const entry = {
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    window.__careerCompassLogs = window.__careerCompassLogs || [];
    window.__careerCompassLogs.push(entry);
    window.dispatchEvent(new CustomEvent('career-compass:log', { detail: entry }));
  }

  const logger = console[level] || console.log;
  logger.call(console, entry);

  return entry;
};

export const logInfo = (message, meta = {}) => emit('info', message, meta);
export const logWarn = (message, meta = {}) => emit('warn', message, meta);
export const logError = (message, error = null, meta = {}) => emit('error', message, {
  ...meta,
  error: serializeError(error),
});
