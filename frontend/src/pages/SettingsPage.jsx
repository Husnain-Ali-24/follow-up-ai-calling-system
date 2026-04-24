import { useState, useEffect } from 'react';
import PageHeader from '../components/shared/PageHeader';
import settingsService from '../services/settingsService';
import { toast } from 'sonner';
import { Save, Phone, Clock } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsService.getSettings();
        setSettings(data);
      } catch (error) {
        toast.error(error?.response?.data?.detail || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="text-sm text-text-secondary">Loading settings...</div>;

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500 pb-20">
      <PageHeader 
        title="Settings" 
        subtitle="Set the hours when the scheduler is allowed to place calls in each lead's local timezone."
        actions={
          <button 
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center space-x-2 disabled:opacity-70"
          >
            {saving ? <Save size={18} className="animate-pulse" /> : <Save size={18} />}
            <span>Save Changes</span>
          </button>
        }
      />

      <section id="calling" className="space-y-6">
        <div className="flex items-center space-x-3 mb-2">
           <div className="p-2 bg-background-card border border-border rounded-lg text-text-muted">
             <Phone size={20} />
           </div>
           <h3 className="text-xl font-bold text-text-primary">Calling Window</h3>
        </div>

        <form onSubmit={handleSave} className="bg-background-card border border-border rounded-xl p-8 space-y-8">
          <div className="p-4 bg-status-info-bg border border-status-info/20 rounded-lg flex items-start space-x-3">
             <Clock size={18} className="text-status-info mt-0.5" />
             <p className="text-xs text-status-info leading-relaxed">
               Calls are evaluated in each lead&apos;s local timezone. If a lead is scheduled outside this range, the system moves the call to the next valid local slot.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Window Start</label>
              <input 
                type="time" 
                value={settings.calling_window_start}
                onChange={(e) => updateSetting('calling_window_start', e.target.value)}
                className="w-full bg-background-secondary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Window End</label>
              <input 
                type="time" 
                value={settings.calling_window_end}
                onChange={(e) => updateSetting('calling_window_end', e.target.value)}
                className="w-full bg-background-secondary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background-secondary/50 px-4 py-3 text-sm text-text-secondary">
            Default window: <span className="font-medium text-text-primary">{settings.calling_window_start} to {settings.calling_window_end}</span>
          </div>
        </form>
      </section>
    </div>
  );
}
