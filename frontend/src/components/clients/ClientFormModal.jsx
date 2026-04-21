import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Plus, Trash2, Globe, MessageSquare, User, Phone, Mail, Info } from 'lucide-react';
import { toast } from 'sonner';
import clientService from '../../services/clientService';

const clientSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  follow_up_context: z.string().min(5, 'Context must be at least 5 characters'),
  previous_interaction: z.string().optional().or(z.literal('')),
  timezone: z.string().default('UTC'),
  notes: z.string().optional().or(z.literal('')),
  custom_fields: z.array(z.object({
    key: z.string().min(1, 'Key required'),
    value: z.string().min(1, 'Value required'),
  })).default([]),
});

function FormSection({ title, color = 'var(--accent-primary)', children }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center space-x-3">
        <div className="w-1 h-5 rounded-full" style={{ background: color }} />
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, icon: Icon, required, error, children }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center space-x-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {Icon && <Icon size={13} style={{ opacity: 0.6 }} />}
        <span>{label}</span>
        {required && <span style={{ color: 'var(--status-error)' }}>*</span>}
      </label>
      {children}
      {error && (
        <p className="text-[10px] font-semibold" style={{ color: 'var(--status-error)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function StyledInput({ error, mono, ...props }) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        height: '44px',
        padding: '0 16px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${error ? 'var(--status-error)' : 'var(--border-input)'}`,
        background: 'var(--bg-input)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        outline: 'none',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
      onFocus={e => {
        e.target.style.borderColor = error ? 'var(--status-error)' : 'var(--border-focus)';
        e.target.style.boxShadow = 'var(--shadow-input)';
      }}
      onBlur={e => {
        e.target.style.borderColor = error ? 'var(--status-error)' : 'var(--border-input)';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

function StyledTextarea({ error, rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      {...props}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${error ? 'var(--status-error)' : 'var(--border-input)'}`,
        background: 'var(--bg-input)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontFamily: 'var(--font-sans)',
        outline: 'none',
        resize: 'none',
        lineHeight: '1.6',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--border-focus)';
        e.target.style.boxShadow = 'var(--shadow-input)';
      }}
      onBlur={e => {
        e.target.style.borderColor = error ? 'var(--status-error)' : 'var(--border-input)';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

export default function ClientFormModal({ open, onOpenChange, onSuccess, client = null }) {
  const isEdit = !!client;

  const initialCustomFields = client?.custom_fields
    ? Object.entries(client.custom_fields).map(([key, value]) => ({ key, value: String(value) }))
    : [];

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? {
      ...client,
      custom_fields: initialCustomFields,
    } : {
      full_name: '',
      phone_number: '',
      email: '',
      follow_up_context: '',
      previous_interaction: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      notes: '',
      custom_fields: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'custom_fields' });

  const onSubmit = async (formData) => {
    try {
      const customFieldsObj = {};
      formData.custom_fields.forEach(f => {
        if (f.key && f.value) customFieldsObj[f.key] = f.value;
      });

      const payload = { ...formData, custom_fields: customFieldsObj };

      if (isEdit) {
        await clientService.updateClient(client.id, payload);
        toast.success('Client updated successfully');
      } else {
        await clientService.createClient(payload);
        toast.success('Client created successfully');
      }
      onSuccess();
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Something went wrong');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)', zIndex: 50 }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            maxWidth: '580px',
            background: 'var(--bg-card)',
            border: `1px solid var(--border-default)`,
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 51,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '92vh',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid var(--border-default)`,
            background: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: 'var(--accent-glow)',
                border: `1px solid var(--border-default)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}>
                {isEdit ? <Info size={20} /> : <Plus size={20} />}
              </div>
              <div>
                <Dialog.Title style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {isEdit ? 'Edit Client Profile' : 'Add New Client'}
                </Dialog.Title>
                <Dialog.Description style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Fill in the details to manage this outbound lead.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              style={{
                padding: '8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)', transition: 'background 120ms ease, color 120ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Primary Info */}
            <FormSection title="Primary Information" color="var(--accent-primary)">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Field label="Full Name" icon={User} required error={errors.full_name?.message}>
                  <StyledInput {...register('full_name')} placeholder="e.g. John Doe" error={errors.full_name} />
                </Field>
                <Field label="Phone Number" icon={Phone} required error={errors.phone_number?.message}>
                  <StyledInput {...register('phone_number')} placeholder="+1 555 000-0000" error={errors.phone_number} mono />
                </Field>
              </div>
              <Field label="Email Address" icon={Mail} error={errors.email?.message}>
                <StyledInput {...register('email')} placeholder="john.doe@example.com" error={errors.email} />
              </Field>
            </FormSection>

            {/* Call Context */}
            <FormSection title="Call Context & AI Logic" color="var(--accent-secondary)">
              <Field label="AI Prompt Context" icon={MessageSquare} required error={errors.follow_up_context?.message}>
                <StyledTextarea
                  {...register('follow_up_context')}
                  placeholder="Describe the purpose of the call and what the AI should achieve..."
                  rows={4}
                  error={errors.follow_up_context}
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Field label="Timezone" icon={Globe}>
                  <StyledInput {...register('timezone')} placeholder="UTC" />
                </Field>
                <Field label="Internal Notes">
                  <StyledInput {...register('notes')} placeholder="Admin-only memo..." />
                </Field>
              </div>
            </FormSection>

            {/* Custom Fields */}
            <FormSection title="Custom Lead Data" color="var(--status-info)">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => append({ key: '', value: '' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-subtle)',
                    border: `1px solid var(--accent-primary)`,
                    color: 'var(--accent-primary)',
                    fontSize: '11px', fontWeight: 700,
                    cursor: 'pointer', transition: 'background 120ms ease',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-subtle)'}
                >
                  <Plus size={13} /> Add Field
                </button>
              </div>

              {fields.length === 0 ? (
                <div style={{
                  border: `1.5px dashed var(--border-strong)`, borderRadius: 'var(--radius-md)',
                  padding: '20px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No custom fields yet. Add fields like "Lead Source", "Budget", or "Project Type".
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {fields.map((field, index) => (
                    <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1 }}>
                        <input
                          {...register(`custom_fields.${index}.key`)}
                          placeholder="Field Name (e.g. Source)"
                          style={{
                            height: '40px', padding: '0 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-input)',
                            background: 'var(--bg-input)', color: 'var(--text-primary)',
                            fontSize: '12px', outline: 'none',
                          }}
                        />
                        <input
                          {...register(`custom_fields.${index}.value`)}
                          placeholder="Value (e.g. Facebook)"
                          style={{
                            height: '40px', padding: '0 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-input)',
                            background: 'var(--bg-input)', color: 'var(--text-primary)',
                            fontSize: '12px', outline: 'none',
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        style={{
                          padding: '8px', flexShrink: 0,
                          borderRadius: 'var(--radius-sm)',
                          background: 'transparent',
                          border: `1px solid var(--border-default)`,
                          color: 'var(--text-muted)', cursor: 'pointer',
                          transition: 'all 120ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--status-error-bg)'; e.currentTarget.style.color = 'var(--status-error)'; e.currentTarget.style.borderColor = 'var(--status-error)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid var(--border-default)`,
            background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px',
          }}>
            <Dialog.Close
              style={{
                padding: '0 20px', height: '42px', borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: `1px solid var(--border-default)`,
                color: 'var(--text-secondary)',
                fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Cancel
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              style={{
                padding: '0 28px', height: '42px', minWidth: '140px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-primary)',
                border: 'none',
                color: 'var(--text-on-accent)',
                fontSize: '14px', fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                boxShadow: 'var(--shadow-accent)',
                transition: 'all 120ms ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-primary-hover)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-primary)'}
            >
              {isSubmitting ? (
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                isEdit ? 'Save Changes' : 'Create Lead'
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
