export const DUMMY_CALLS = [
  {
    call_id: 'call-001', client_id: 'c-003', client_name: 'James Brown',
    client_phone: '+442071234567', vapi_call_id: 'vapi_abc123', attempt_number: 1,
    started_at: new Date(Date.now() - 3600000).toISOString(),
    ended_at: new Date(Date.now() - 3420000).toISOString(), duration_seconds: 180,
    status: 'completed',
    transcript: `AI: Hello, is this James Brown?\nJames: Yes, speaking.\nAI: Hi James, I'm calling from Acme Corp regarding the contract we sent over on April 10th.\nJames: Yes, they reviewed it. We have one small question about the SLA clause in section 4.\nAI: Of course, I'll note that and have someone reach out to clarify. Anything else?\nJames: No, that's the only thing. We're ready to move forward.\nAI: Fantastic! I'll flag this for immediate follow-up. Thank you James!\nJames: You too. Bye.`,
    summary: 'James reviewed the contract and is ready to proceed. Outstanding question on SLA clause in section 4.',
    structured_answers: {
      contract_reviewed: 'Yes', concerns: 'SLA clause in section 4',
      ready_to_proceed: 'Yes, pending SLA clarification', next_action: 'Sales team to clarify SLA section 4',
    },
    sentiment: 'positive', recording_url: 'https://recordings.example.com/call-001.mp3',
    created_at: new Date().toISOString(),
  },
  {
    call_id: 'call-002', client_id: 'c-002', client_name: 'Sarah Johnson',
    client_phone: '+12125551234', vapi_call_id: 'vapi_def456', attempt_number: 2,
    started_at: new Date(Date.now() - 7200000).toISOString(),
    ended_at: new Date(Date.now() - 6960000).toISOString(), duration_seconds: 240,
    status: 'rescheduled', rescheduled_to: new Date(Date.now() + 86400000).toISOString(),
    summary: 'Sarah is in back-to-back meetings. Asked to be called tomorrow at 2pm EST.',
    sentiment: 'neutral',
    structured_answers: { available: 'No — in meetings', rescheduled_to: 'Tomorrow 2pm EST', interest_level: 'Still interested' },
    created_at: new Date().toISOString(),
  },
  {
    call_id: 'call-003', client_id: 'c-005', client_name: 'Carlos Martinez',
    client_phone: '+34911234567', vapi_call_id: 'vapi_ghi789', attempt_number: 3,
    started_at: new Date(Date.now() - 10800000).toISOString(),
    ended_at: new Date(Date.now() - 10650000).toISOString(), duration_seconds: 150,
    status: 'no_answer', sentiment: undefined, created_at: new Date().toISOString(),
  },
];

export const DUMMY_CALL_EVENTS = [
  { event_id: 'ev-1', type: 'dial',      timestamp: new Date(Date.now() - 3600000).toISOString(), description: 'Outbound call initiated to +442071234567' },
  { event_id: 'ev-2', type: 'pickup',    timestamp: new Date(Date.now() - 3598000).toISOString(), description: 'Client answered the call' },
  { event_id: 'ev-3', type: 'ai_turn',   timestamp: new Date(Date.now() - 3597000).toISOString(), description: 'AI: Greeting and identity verification' },
  { event_id: 'ev-4', type: 'user_turn', timestamp: new Date(Date.now() - 3594000).toISOString(), description: 'Client confirmed identity' },
  { event_id: 'ev-5', type: 'ai_turn',   timestamp: new Date(Date.now() - 3590000).toISOString(), description: 'AI: Purpose statement — contract follow-up' },
  { event_id: 'ev-6', type: 'user_turn', timestamp: new Date(Date.now() - 3575000).toISOString(), description: 'Client: Has SLA question in section 4' },
  { event_id: 'ev-7', type: 'ai_turn',   timestamp: new Date(Date.now() - 3560000).toISOString(), description: 'AI: Acknowledged, logged action item' },
  { event_id: 'ev-8', type: 'end',       timestamp: new Date(Date.now() - 3420000).toISOString(), description: 'Call ended — completed successfully' },
];
