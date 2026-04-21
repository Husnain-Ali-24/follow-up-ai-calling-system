import api from './api';

const settingsService = {
  getSettings: async () => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return {
      business_name: 'Acme Corp',
      caller_id_number: '+1234567890',
      vapi_api_key: 'sk_vapi_**********',
      openai_api_key: 'sk_openai_**********',
      calling_window_start: '09:00',
      calling_window_end: '18:00',
      calling_window_timezone: 'America/New_York',
      max_retry_attempts: 3,
      retry_delay_minutes: [30, 120, 480],
      max_reschedules: 2,
      voicemail_action: 'leave_message',
      recording_enabled: true,
      conversation_prompt: 'You are a helpful assistant calling to follow up on a recent proposal...',
    };
  },
  
  updateSettings: async (payload) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return payload;
  }
};

export default settingsService;
