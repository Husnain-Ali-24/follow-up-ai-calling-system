export const APP_CONFIG = {
  TITLE: 'AI Outbound Calling System',
  PAGE_SIZE: 10,
  DATE_FORMAT: 'MMM dd, yyyy HH:mm',
};

export const STATUS_VARIANTS = {
  pending: 'status-info',
  in_progress: 'status-info',
  completed: 'status-success',
  failed: 'status-error',
  rescheduled: 'status-warning',
  no_answer: 'status-neutral',
  voicemail: 'status-neutral',
  refused: 'status-error',
};

export const SENTIMENT_VARIANTS = {
  positive: 'sentiment-positive',
  neutral: 'sentiment-neutral',
  negative: 'sentiment-negative',
};
