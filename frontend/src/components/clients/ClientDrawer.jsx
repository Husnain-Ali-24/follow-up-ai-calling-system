import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  X, Phone, Mail, Globe, Clock, Edit2, Trash2,
  PhoneCall, Calendar, Zap, Plus, Check, MessageSquare, User, Save, XCircle, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import clientService from '../../services/clientService';

const schema = z.object({
  full_name: z.string().min(2, 'Name is too short'),
  phone_number: z.string().min(10, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  follow_up_context: z.string().min(3, 'Context is required'),
  scheduled_call_time: z.string().optional().or(z.literal('')),
  timezone: z.string().default('UTC'),
  notes: z.string().optional().or(z.literal('')),
  custom_fields: z.array(z.object({
    key: z.string().min(1, 'Key required'),
    value: z.string().default('')
  })).default([]),
});

const STATUS_MAP = {
  pending:     { color: '#818cf8', bg: 'rgba(129,140,248,0.15)', label: 'Pending' },
  in_progress: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  label: 'In Progress' },
  completed:   { color: '#34d399', bg: 'rgba(52,211,153,0.15)',  label: 'Completed' },
  failed:      { color: '#f87171', bg: 'rgba(248,113,113,0.15)', label: 'Failed' },
  rescheduled: { color: '#c084fc', bg: 'rgba(192,132,252,0.15)', label: 'Rescheduled' },
};

const GRADS = [['#6366f1','#a855f7'],['#3b82f6','#06b6d4'],['#10b981','#34d399'],['#f59e0b','#fbbf24'],['#ef4444','#f43f5e']];
const getAvatarStyle = (n) => {
  const [a, b] = GRADS[(n?.charCodeAt(0) || 65) % GRADS.length];
  return { background: `linear-gradient(135deg, ${a}, ${b})` };
};

const toDateTimeLocalInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function ClientDrawer({ client, onClose, onRefresh }) {
  const [tab, setTab] = useState('details');
  const [isSaving, setIsSaving] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  // Memoize custom fields for the form
  const formCustomFields = useMemo(() => {
    if (!client?.custom_fields) return [];
    return Object.entries(client.custom_fields).map(([key, value]) => ({
      key,
      value: String(value)
    }));
  }, [client]);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ...client,
      scheduled_call_time: toDateTimeLocalInputValue(client?.scheduled_call_time),
      custom_fields: formCustomFields,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'custom_fields' });

  // Sync form when client changes
  useEffect(() => {
    if (client) {
      reset({
        ...client,
        scheduled_call_time: toDateTimeLocalInputValue(client.scheduled_call_time),
        custom_fields: Object.entries(client.custom_fields || {}).map(([key, value]) => ({
          key,
          value: String(value)
        }))
      });
      setTab('details');
    }
  }, [client?.id, reset]); // Only trigger on ID change to avoid loop

  if (!client) return null;

  const st = STATUS_MAP[client.status] || STATUS_MAP.pending;

  const handleTriggerCall = async () => {
    setIsCalling(true);
    try {
      await new Promise(r => setTimeout(r, 1200));
      toast.success(`Call initiated for ${client.full_name}`);
    } catch {
      toast.error('Failed to trigger call');
    } finally {
      setIsCalling(false);
    }
  };

  const onSubmit = async (values) => {
    setIsSaving(true);
    try {
      const customFieldsObj = {};
      values.custom_fields.forEach(f => {
        if (f.key && f.key.trim()) {
          customFieldsObj[f.key.trim()] = f.value;
        }
      });

      // SMART DIFF: Only send fields that actually changed
      const payload = {};
      
      if (values.full_name !== client.full_name) payload.full_name = values.full_name;
      if (values.phone_number !== client.phone_number) payload.phone_number = values.phone_number;
      if (values.email !== client.email) payload.email = values.email || null;
      if (values.follow_up_context !== client.follow_up_context) payload.follow_up_context = values.follow_up_context;
      if ((values.scheduled_call_time || '') !== toDateTimeLocalInputValue(client.scheduled_call_time)) {
        payload.scheduled_call_time = values.scheduled_call_time || null;
      }
      if (values.timezone !== client.timezone) payload.timezone = values.timezone;
      if (values.notes !== client.notes) payload.notes = values.notes || null;
      
      // Always compare custom fields as a whole
      if (JSON.stringify(customFieldsObj) !== JSON.stringify(client.custom_fields || {})) {
        payload.custom_fields = customFieldsObj;
      }

      // If nothing changed, just close the edit mode
      if (Object.keys(payload).length === 0) {
        setTab('details');
        setIsSaving(false);
        return;
      }

      await clientService.updateClient(client.id, payload);
      toast.success('Lead updated successfully');
      setTab('details');
      onRefresh(); // Refresh parent list
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to save changes');
      console.error('Update Error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease'
      }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, zIndex: 9999,
        height: '100vh',
        width: '100%', maxWidth: '480px', background: 'var(--bg-secondary)',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)', borderLeft: '1px solid var(--border-default)'
      }}>
        
        {/* Header Section */}
        <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)', padding: '14px 20px 10px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{
              width: 50, height: 50, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 21, fontWeight: 800, ...getAvatarStyle(client.full_name)
            }}>
              {client.full_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {client.full_name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: 10, fontWeight: 700, background: st.bg, color: st.color, textTransform: 'uppercase' }}>
                  {st.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{client.phone_number}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ padding: 8, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button 
              onClick={handleTriggerCall}
              disabled={isCalling}
              style={{
                flex: 1, height: 36, borderRadius: '8px', background: 'var(--accent-primary)', color: '#fff',
                border: 'none', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer', boxShadow: '0 4px 12px var(--accent-glow)', opacity: isCalling ? 0.7 : 1
              }}
            >
              {isCalling ? <div className="spinner-sm" /> : <><Zap size={14} fill="currentColor" /> Trigger Call</>}
            </button>
            <button 
              onClick={() => setTab(tab === 'edit' ? 'details' : 'edit')}
              style={{
                padding: '0 12px', height: 36, borderRadius: '8px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
              }}
            >
              {tab === 'edit' ? <><XCircle size={14} /> Cancel</> : <><Edit2 size={14} /> Edit</>}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-secondary)', borderRadius: '10px' }}>
            <button onClick={() => setTab('details')} style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: tab === 'details' ? 'var(--bg-card)' : 'transparent', color: tab === 'details' ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: tab === 'details' ? 'var(--shadow-sm)' : 'none' }}>Details</button>
            <button onClick={() => setTab('edit')} style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: tab === 'edit' ? 'var(--bg-card)' : 'transparent', color: tab === 'edit' ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: tab === 'edit' ? 'var(--shadow-sm)' : 'none' }}>Edit Form</button>
          </div>
        </div>

        {/* Content Section */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 20px 20px' }} className="custom-scrollbar">
          {tab === 'details' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: 10, letterSpacing: '0.1em' }}>Basic Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                  <InfoRow icon={Mail} label="Email Address" value={client.email} />
                  <InfoRow icon={Globe} label="Timezone" value={client.timezone} />
                  <InfoRow icon={Calendar} label="Scheduled Call" value={client.scheduled_call_time ? new Date(client.scheduled_call_time).toLocaleString() : 'Not scheduled'} />
                  <InfoRow icon={Clock} label="Date Added" value={new Date(client.created_at).toLocaleDateString()} />
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-secondary)', marginBottom: 10, letterSpacing: '0.1em' }}>AI Strategy & Context</h4>
                <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', borderLeft: '4px solid var(--accent-secondary)' }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>"{client.follow_up_context}"</p>
                </div>
              </div>

              {client.notes && (
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.1em' }}>Internal Notes</h4>
                  <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-default)', fontSize: 13, color: 'var(--text-secondary)' }}>{client.notes}</div>
                </div>
              )}

              {Object.keys(client.custom_fields || {}).length > 0 && (
                <div>
                  <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#a78bfa', marginBottom: 10, letterSpacing: '0.1em' }}>Custom Lead Metadata</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {Object.entries(client.custom_fields).map(([key, value]) => (
                      <div key={key} style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-default)' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{key}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ paddingBottom: 20 }}>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div style={{ marginBottom: 20 }}>
                  <label className="input-label"><User size={12} /> Full Name</label>
                  <input {...register('full_name')} className="premium-input" placeholder="Enter name" />
                  {errors.full_name && <p className="error-text">{errors.full_name.message}</p>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label className="input-label"><Phone size={12} /> Phone Number</label>
                    <input {...register('phone_number')} className="premium-input" placeholder="Phone" />
                    {errors.phone_number && <p className="error-text">{errors.phone_number.message}</p>}
                  </div>
                  <div>
                    <label className="input-label"><Mail size={12} /> Email Address</label>
                    <input {...register('email')} className="premium-input" placeholder="Email" />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label className="input-label"><MessageSquare size={12} /> AI Follow-up Context</label>
                  <textarea {...register('follow_up_context')} className="premium-input" style={{ height: 100, paddingTop: 10, resize: 'none' }} placeholder="What should the AI know about this lead?" />
                  {errors.follow_up_context && <p className="error-text">{errors.follow_up_context.message}</p>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label className="input-label"><Calendar size={12} /> Scheduled Call</label>
                    <input {...register('scheduled_call_time')} type="datetime-local" className="premium-input" />
                  </div>
                  <div>
                    <label className="input-label"><Globe size={12} /> Timezone</label>
                    <input {...register('timezone')} className="premium-input" />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div>
                    <label className="input-label">Notes</label>
                    <input {...register('notes')} className="premium-input" />
                  </div>
                </div>

                <div style={{ margin: '24px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#a78bfa', margin: 0 }}>Custom Fields</h4>
                  <button type="button" onClick={() => append({ key: '', value: '' })} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Add Field</button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input {...register(`custom_fields.${index}.key`)} className="premium-input" style={{ flex: 1, height: 38 }} placeholder="Key (e.g. Duty)" />
                    <input {...register(`custom_fields.${index}.value`)} className="premium-input" style={{ flex: 1, height: 38 }} placeholder="Value" />
                    <button 
                      type="button" 
                      onClick={() => remove(index)} 
                      style={{ 
                        width: 38, height: 38, borderRadius: 8, 
                        background: 'var(--status-error-bg)', color: 'var(--status-error)', 
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button 
                  type="submit"
                  disabled={isSaving}
                  style={{
                    width: '100%', height: 44, marginTop: 24, borderRadius: 12, background: 'var(--accent-primary)',
                    color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px var(--accent-glow)'
                  }}
                >
                  {isSaving ? <div className="spinner-sm" /> : <><Save size={16} /> Save Changes</>}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .input-label { display: flex; alignItems: center; gap: 6px; fontSize: 11px; fontWeight: 700; color: 'var(--text-muted)'; text-transform: uppercase; margin-bottom: 6px; }
        .premium-input { width: 100%; height: 40px; padding: 0 14px; background: var(--bg-elevated); border: 1.5px solid var(--border-default); border-radius: 10px; color: var(--text-primary); fontSize: 13px; outline: none; transition: border-color 0.2s; }
        .premium-input:focus { border-color: var(--accent-primary); }
        .error-text { font-size: 10px; color: var(--status-error); margin-top: 4px; font-weight: 600; }
        .spinner-sm { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 10px; }
      `}</style>
    </>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, marginBottom: 8 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || 'N/A'}</div>
      </div>
    </div>
  );
}
