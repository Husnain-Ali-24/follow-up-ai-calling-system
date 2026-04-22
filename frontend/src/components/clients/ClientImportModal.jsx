import React, { useMemo, useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Papa from 'papaparse';
import { X, Upload, Check, Settings2, ArrowRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import clientService from '../../services/clientService';

// ─── System field definitions ─────────────────────────────────────────────────
const DB_FIELDS = [
  { key: 'full_name',           label: 'Full Name',          required: true  },
  { key: 'phone_number',        label: 'Phone Number',       required: true  },
  { key: 'email',               label: 'Email',              required: false },
  { key: 'follow_up_context',   label: 'Follow-up Context',  required: false },
  { key: 'previous_interaction',label: 'Previous Interaction',required: false },
  { key: 'scheduled_call_time', label: 'Scheduled Call Time', required: false },
  { key: 'timezone',            label: 'Timezone',           required: false },
  { key: 'notes',               label: 'Notes',              required: false },
];

// ─── Smart alias map: CSV column variants → system field key ─────────────────
// Normalised to lowercase + only a-z before comparison.
const FIELD_ALIASES = {
  full_name: [
    'name', 'fullname', 'full name', 'firstname', 'first name', 'first',
    'lastname', 'last name', 'contactname', 'contact name', 'clientname',
    'client name', 'leadname', 'lead name', 'customer', 'customername',
    'customer name', 'person', 'personname',
  ],
  phone_number: [
    'phone', 'phonenumber', 'phone number', 'mobile', 'mobilenumber',
    'mobile number', 'cell', 'cellphone', 'cell phone', 'tel', 'telephone',
    'contact', 'contactnumber', 'contact number', 'whatsapp', 'number',
  ],
  email: [
    'email', 'emailaddress', 'email address', 'mail', 'e-mail', 'emailid',
  ],
  follow_up_context: [
    'context', 'followupcontext', 'follow up context', 'reason', 'note',
    'description', 'purpose', 'callreason', 'call reason', 'agenda',
  ],
  previous_interaction: [
    'previousinteraction', 'previous interaction', 'lastinteraction',
    'last interaction', 'history', 'previousnote', 'lastnote', 'previouscall',
  ],
  scheduled_call_time: [
    'scheduledcalltime', 'scheduled call time', 'scheduledat', 'scheduled at',
    'scheduletime', 'schedule time', 'calltime', 'call time',
    'appointmenttime', 'appointment time', 'followuptime', 'follow up time',
  ],
  timezone: ['timezone', 'time zone', 'tz', 'region'],
  notes: ['notes', 'internalnotes', 'internal notes', 'memo', 'comment', 'comments', 'remark', 'remarks'],
};

/**
 * Normalise a CSV header string for fuzzy comparison.
 * Strips everything except lowercase a-z.
 */
const normalise = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Given a raw CSV header string, return the matching DB field key or null.
 * Checks exact key match → exact label match → alias list.
 */
function autoDetectField(header) {
  const n = normalise(header);
  // 1. Exact key match (e.g. "phone_number")
  const byKey = DB_FIELDS.find(f => normalise(f.key) === n);
  if (byKey) return byKey.key;
  // 2. Exact label match (e.g. "Phone Number")
  const byLabel = DB_FIELDS.find(f => normalise(f.label) === n);
  if (byLabel) return byLabel.key;
  // 3. Alias match
  for (const [fieldKey, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(alias => normalise(alias) === n)) return fieldKey;
  }
  return null;
}

/**
 * Estimate total row count from file size and average first-row byte length.
 * Used only for display; the real count comes after full parse.
 */
function estimateRowCount(file, sampleBytes) {
  if (!sampleBytes || sampleBytes === 0) return '?';
  const est = Math.round(file.size / sampleBytes);
  return est.toLocaleString();
}

function isValidTimezone(value) {
  if (!value) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

function isValidScheduledValue(value) {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}

function getMappedHeader(mappings, fieldKey) {
  return Object.entries(mappings).find(([, mapped]) => mapped === fieldKey)?.[0] ?? null;
}

function summarizeScheduling(rows, mappings) {
  const scheduleHeader = getMappedHeader(mappings, 'scheduled_call_time');
  const timezoneHeader = getMappedHeader(mappings, 'timezone');

  if (!scheduleHeader) {
    return {
      hasScheduleMapping: false,
      scheduledRows: 0,
      invalidScheduleRows: 0,
      missingTimezoneRows: 0,
      invalidTimezoneRows: 0,
    };
  }

  let scheduledRows = 0;
  let invalidScheduleRows = 0;
  let missingTimezoneRows = 0;
  let invalidTimezoneRows = 0;

  rows.forEach((row) => {
    const scheduledValue = String(row?.[scheduleHeader] ?? '').trim();
    if (!scheduledValue) return;

    scheduledRows += 1;

    if (!isValidScheduledValue(scheduledValue)) {
      invalidScheduleRows += 1;
    }

    const timezoneValue = String(
      timezoneHeader ? (row?.[timezoneHeader] ?? '') : ''
    ).trim();

    if (!timezoneValue) {
      missingTimezoneRows += 1;
      return;
    }

    try {
      if (!isValidTimezone(timezoneValue)) {
        invalidTimezoneRows += 1;
      }
    } catch {
      invalidTimezoneRows += 1;
    }
  });

  return {
    hasScheduleMapping: true,
    scheduledRows,
    invalidScheduleRows,
    missingTimezoneRows,
    invalidTimezoneRows,
  };
}

export default function ClientImportModal({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState(1);
  // Preview rows (first 5) — used to show sample values in the mapping UI
  const [previewRows, setPreviewRows] = useState([]);
  // Full parsed data — populated only when user confirms import
  const [totalRowCount, setTotalRowCount] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  // Keep a reference to the raw File object for deferred full parse
  const fileRef = useRef(null);
  const previewScheduleSummary = useMemo(
    () => summarizeScheduling(previewRows, mappings),
    [previewRows, mappings]
  );

  // ── Step 1 → Step 2: Fast header + preview parse (first 6 rows only) ──────
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileRef.current = file;

    let rowBuffer = [];
    let parsedHeaders = [];
    let totalRows = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      // Stream row-by-row so we can abort early
      step: (result, parser) => {
        totalRows++;
        if (totalRows === 1) {
          parsedHeaders = Object.keys(result.data);
        }
        if (totalRows <= 5) {
          rowBuffer.push(result.data);
        } else {
          // We have enough data — abort the rest of the file
          parser.abort();
        }
      },
      complete: () => {
        if (parsedHeaders.length === 0) {
          toast.error('CSV appears empty or has no headers.');
          return;
        }

        setHeaders(parsedHeaders);
        setPreviewRows(rowBuffer);

        // Build smart initial mappings for every CSV column
        const initialMappings = {};
        parsedHeaders.forEach(header => {
          const matched = autoDetectField(header);
          initialMappings[header] = matched ?? 'custom';
        });
        setMappings(initialMappings);
        setStep(2);
      },
      error: (err) => toast.error('Failed to read CSV: ' + err.message),
    });
  };

  // ── Step 2 → Import: Full parse of the entire file ───────────────────────
  const handleImport = async () => {
    const mappedDbFields = Object.values(mappings);
    const missing = DB_FIELDS.filter(f => f.required && !mappedDbFields.includes(f.key));
    if (missing.length > 0) {
      toast.error(`Please map required fields: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    if (mappedDbFields.includes('scheduled_call_time') && !mappedDbFields.includes('timezone')) {
      toast.error('Map a timezone column when using scheduled call time for auto-calling.');
      return;
    }

    setIsImporting(true);
    try {
      // Full parse happens here — only once, at import time
      const fullData = await new Promise((resolve, reject) => {
        Papa.parse(fileRef.current, {
          header: true,
          skipEmptyLines: true,
          complete: (r) => resolve(r.data),
          error: reject,
        });
      });

      setTotalRowCount(fullData.length);
      const schedulingSummary = summarizeScheduling(fullData, mappings);

      if (schedulingSummary.invalidScheduleRows > 0) {
        toast.error(`Fix ${schedulingSummary.invalidScheduleRows} row(s) with invalid scheduled call times before import.`);
        return;
      }

      if (schedulingSummary.missingTimezoneRows > 0 || schedulingSummary.invalidTimezoneRows > 0) {
        toast.error(
          `Fix timezone values before import. Missing: ${schedulingSummary.missingTimezoneRows}, invalid: ${schedulingSummary.invalidTimezoneRows}.`
        );
        return;
      }

      const mappedData = fullData.map(row => {
        const client = {};
        const custom_fields = {};
        Object.entries(mappings).forEach(([csvHeader, mappingType]) => {
          if (mappingType === 'ignore') return;
          if (mappingType === 'custom') custom_fields[csvHeader] = row[csvHeader] ?? '';
          else client[mappingType] = row[csvHeader] ?? '';
        });
        return {
          ...client,
          follow_up_context: client.follow_up_context || 'Imported via CSV',
          timezone: client.timezone || 'UTC',
          custom_fields,
        };
      });

      await clientService.importBulk(mappedData);
      toast.success(`Successfully imported ${mappedData.length} leads`);
      onSuccess();
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('[Import] Error:', error);
      const msg = error?.response?.data?.detail;
      const errorStr = typeof msg === 'string' ? msg : JSON.stringify(msg) || 'Import failed';
      toast.error(errorStr);
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setPreviewRows([]);
    setTotalRowCount(null);
    setHeaders([]);
    setMappings({});
    fileRef.current = null;
  };

  const getMappingStyle = (mappingType) => {
    if (mappingType === 'ignore') return {
      rowBg: 'var(--bg-secondary)', rowBorder: 'var(--border-subtle)',
      selectBg: 'var(--bg-secondary)', selectColor: 'var(--text-muted)', selectBorder: 'var(--border-subtle)', opacity: 0.7,
    };
    if (mappingType === 'custom') return {
      rowBg: 'var(--status-info-bg)', rowBorder: 'var(--status-info)',
      selectBg: 'var(--status-info-bg)', selectColor: 'var(--status-info)', selectBorder: 'var(--status-info)', opacity: 1,
    };
    return {
      rowBg: 'var(--bg-card)', rowBorder: 'var(--border-default)',
      selectBg: 'var(--bg-input)', selectColor: 'var(--text-primary)', selectBorder: 'var(--border-input)', opacity: 1,
    };
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(resetState, 200); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)', zIndex: 50 }}
        />
        <Dialog.Content
          style={{
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            width: '100%', maxWidth: '680px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 51,
            display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40, height: 40,
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-glow)',
                border: '1px solid var(--border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}>
                <Upload size={20} />
              </div>
              <div>
                <Dialog.Title style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Import Leads
                </Dialog.Title>
                <Dialog.Description style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Step {step} of 2 — {step === 1 ? 'Upload your CSV file' : 'Map your columns to system fields'}
                </Dialog.Description>
              </div>
            </div>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
              {[1, 2].map(n => (
                <div key={n} style={{
                  width: n === step ? 28 : 8, height: 8,
                  borderRadius: 99,
                  background: n === step ? 'var(--accent-primary)' : 'var(--border-strong)',
                  transition: 'all 250ms ease',
                }} />
              ))}
            </div>

            <Dialog.Close
              style={{
                padding: '8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)', transition: 'background 120ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {step === 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '220px',
                  border: '2px dashed var(--border-strong)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  transition: 'border-color 150ms ease, background 150ms ease',
                  background: 'var(--bg-secondary)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'var(--accent-subtle)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'var(--accent-glow)',
                      border: '1px solid var(--accent-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent-primary)',
                    }}>
                      <Upload size={28} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Click to upload or drag & drop</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>CSV files only</p>
                    </div>
                  </div>
                  <input type="file" style={{ display: 'none' }} accept=".csv" onChange={handleFileUpload} />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {[
                    { icon: Check, color: 'var(--status-success)', text: 'Include country codes in phone numbers (+1, +44, etc.) for accurate AI calling.' },
                    { icon: Zap, color: 'var(--accent-primary)', text: 'Smart detection: columns like "Name", "Mobile", "Schedule Time", and "Timezone" are auto-mapped when possible.' },
                  ].map(({ icon: Icon, color, text }, i) => (
                    <div key={i} style={{
                      padding: '14px 16px', borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      display: 'flex', gap: '12px',
                    }}>
                      <Icon size={16} style={{ color, flexShrink: 0, marginTop: 2 }} />
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {previewScheduleSummary.hasScheduleMapping && (
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: previewScheduleSummary.invalidScheduleRows || previewScheduleSummary.missingTimezoneRows || previewScheduleSummary.invalidTimezoneRows
                      ? 'var(--status-warning-bg)'
                      : 'var(--status-success-bg)',
                    border: `1px solid ${
                      previewScheduleSummary.invalidScheduleRows || previewScheduleSummary.missingTimezoneRows || previewScheduleSummary.invalidTimezoneRows
                        ? 'var(--status-warning)'
                        : 'var(--status-success)'
                    }`,
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                      Scheduling preview
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {previewScheduleSummary.scheduledRows > 0
                        ? `${previewScheduleSummary.scheduledRows} preview row(s) include scheduled call times.`
                        : 'A schedule column is mapped, but the preview rows are empty for it.'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
                      Invalid times: {previewScheduleSummary.invalidScheduleRows} · Missing timezones: {previewScheduleSummary.missingTimezoneRows} · Invalid timezones: {previewScheduleSummary.invalidTimezoneRows}
                    </div>
                  </div>
                )}

                {/* Column header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 40px 1fr',
                  padding: '8px 16px', gap: '8px',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    CSV Column
                  </span>
                  <span />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Maps To
                  </span>
                </div>

                {headers.map(header => {
                  const currentMapping = mappings[header];
                  const s = getMappingStyle(currentMapping);
                  return (
                    <div key={header} style={{
                      display: 'grid', gridTemplateColumns: '1fr 40px 1fr',
                      alignItems: 'center', gap: '8px',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: s.rowBg,
                      border: `1px solid ${s.rowBorder}`,
                      opacity: s.opacity,
                      transition: 'all 150ms ease',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{header}</p>
                          {/* Show badge if field was auto-detected to a system field */}
                          {currentMapping !== 'custom' && currentMapping !== 'ignore' && (
                            <span style={{
                              fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em',
                              padding: '1px 6px', borderRadius: 99,
                              background: 'var(--status-success-bg)',
                              color: 'var(--status-success)',
                              border: '1px solid var(--status-success)',
                              textTransform: 'uppercase',
                            }}>Auto</span>
                          )}
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          e.g. {String(previewRows[0]?.[header] ?? '—').substring(0, 28)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <ArrowRight size={15} />
                      </div>
                      <select
                        value={currentMapping}
                        onChange={e => setMappings({ ...mappings, [header]: e.target.value })}
                        style={{
                          width: '100%', height: '38px', padding: '0 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${s.selectBorder}`,
                          background: s.selectBg,
                          color: s.selectColor,
                          fontSize: '13px', fontWeight: 500,
                          cursor: 'pointer', outline: 'none',
                        }}
                      >
                        <optgroup label="— System Fields —">
                          {DB_FIELDS.map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}{f.required ? ' *' : ''}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="— Actions —">
                          <option value="custom">✨ Create as Custom Field</option>
                          <option value="ignore">🚫 Ignore this column</option>
                        </optgroup>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {step === 2 && (
                <>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{totalRowCount ?? `~${estimateRowCount(fileRef.current, 50)}`}</span>
                  {' rows · '}
                  <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>
                    {Object.values(mappings).filter(m => m !== 'custom' && m !== 'ignore').length}
                  </span>
                  {' mapped · '}
                  <span style={{ color: 'var(--status-info)', fontWeight: 600 }}>
                    {Object.values(mappings).filter(m => m === 'custom').length}
                  </span>
                  {' custom'}
                  {previewScheduleSummary.hasScheduleMapping && (
                    <>
                      {' · '}
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                        schedule enabled
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  style={{
                    padding: '0 18px', height: '40px',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Back
                </button>
              )}
              <Dialog.Close
                style={{
                  padding: '0 18px', height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Cancel
              </Dialog.Close>
              {step === 2 && (
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  style={{
                    padding: '0 24px', height: '40px', minWidth: '160px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-primary)',
                    border: 'none',
                    color: 'var(--text-on-accent)',
                    fontSize: '14px', fontWeight: 600,
                    cursor: isImporting ? 'not-allowed' : 'pointer',
                    opacity: isImporting ? 0.6 : 1,
                    boxShadow: 'var(--shadow-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={e => { if (!isImporting) e.currentTarget.style.background = 'var(--accent-primary-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-primary)'; }}
                >
                  {isImporting ? (
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <><Check size={16} /> Import Leads</>
                  )}
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
