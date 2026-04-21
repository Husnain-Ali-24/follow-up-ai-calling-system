export const DUMMY_STATS = {
  calls_today: 47, calls_successful: 31, calls_failed: 8,
  calls_rescheduled: 6, calls_pending: 12, success_rate: 66, avg_duration_seconds: 187,
};

export const DUMMY_CALL_VOLUME = [
  { date: 'Apr 14', completed: 38, failed: 7,  rescheduled: 4 },
  { date: 'Apr 15', completed: 42, failed: 9,  rescheduled: 6 },
  { date: 'Apr 16', completed: 35, failed: 11, rescheduled: 3 },
  { date: 'Apr 17', completed: 50, failed: 6,  rescheduled: 8 },
  { date: 'Apr 18', completed: 44, failed: 8,  rescheduled: 5 },
  { date: 'Apr 19', completed: 29, failed: 5,  rescheduled: 3 },
  { date: 'Apr 20', completed: 31, failed: 8,  rescheduled: 6 },
];

export const DUMMY_RECENT_ACTIVITY = [
  { call_id: 'call-001', client_name: 'James Brown',     phone_number: '+442071234567', status: 'completed',   sentiment: 'positive', ended_at: new Date(Date.now() - 3420000).toISOString(),  duration_seconds: 180 },
  { call_id: 'call-002', client_name: 'Sarah Johnson',   phone_number: '+12125551234',  status: 'rescheduled', sentiment: 'neutral',  ended_at: new Date(Date.now() - 6960000).toISOString(),  duration_seconds: 240 },
  { call_id: 'call-003', client_name: 'Carlos Martinez', phone_number: '+34911234567',  status: 'no_answer',                          ended_at: new Date(Date.now() - 10650000).toISOString(), duration_seconds: 150 },
  { call_id: 'call-004', client_name: 'Zara Sheikh',     phone_number: '+971501234567', status: 'completed',   sentiment: 'positive', ended_at: new Date(Date.now() - 14400000).toISOString(), duration_seconds: 210 },
  { call_id: 'call-005', client_name: 'Ahmed Khan',      phone_number: '+923001234567', status: 'failed',                             ended_at: new Date(Date.now() - 18000000).toISOString(), duration_seconds: 0   },
];
