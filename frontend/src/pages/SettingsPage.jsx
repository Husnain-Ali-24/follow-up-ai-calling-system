import { useState, useEffect } from 'react';
import PageHeader from '../components/shared/PageHeader';
import settingsService from '../services/settingsService';
import { toast } from 'sonner';
import { Save, Key, Phone, Clock, MessageSquare, Database, ShieldCheck, Headphones } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsService.getSettings();
        setSettings(data);
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
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-500 pb-20">
      <PageHeader 
        title="Settings" 
        subtitle="Global configuration for your AI calling system and integrations."
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 border-r border-border pr-8 space-y-1">
           <a href="#general" className="flex items-center px-4 py-2.5 rounded-lg bg-accent-glow text-accent-primary font-medium text-sm">
             <Database size={16} className="mr-3" /> General
           </a>
           <a href="#api" className="flex items-center px-4 py-2.5 rounded-lg text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors text-sm">
             <Key size={16} className="mr-3" /> API Keys
           </a>
           <a href="#calling" className="flex items-center px-4 py-2.5 rounded-lg text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors text-sm">
             <Phone size={16} className="mr-3" /> Calling Window
           </a>
           <a href="#prompt" className="flex items-center px-4 py-2.5 rounded-lg text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors text-sm">
             <MessageSquare size={16} className="mr-3" /> AI Prompt
           </a>
           <a href="#security" className="flex items-center px-4 py-2.5 rounded-lg text-text-secondary hover:bg-background-hover hover:text-text-primary transition-colors text-sm">
             <ShieldCheck size={16} className="mr-3" /> Security
           </a>
        </aside>

        <div className="lg:col-span-3 space-y-12">
          {/* General Section */}
          <section id="general" className="space-y-6">
            <div className="flex items-center space-x-3 mb-2">
               <div className="p-2 bg-background-card border border-border rounded-lg text-text-muted">
                 <Database size={20} />
               </div>
               <h3 className="text-xl font-bold text-text-primary">General Configuration</h3>
            </div>
            
            <div className="bg-background-card border border-border rounded-xl p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Business Name</label>
                  <input 
                    type="text" 
                    value={settings.business_name}
                    onChange={(e) => updateSetting('business_name', e.target.value)}
                    className="w-full bg-background-secondary border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Caller ID Number</label>
                  <input 
                    type="text" 
                    value={settings.caller_id_number}
                    onChange={(e) => updateSetting('caller_id_number', e.target.value)}
                    className="w-full bg-background-secondary border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* API Keys Section */}
          <section id="api" className="space-y-6 pt-6 border-t border-border/50">
            <div className="flex items-center space-x-3 mb-2">
               <div className="p-2 bg-background-card border border-border rounded-lg text-text-muted">
                 <Key size={20} />
               </div>
               <h3 className="text-xl font-bold text-text-primary">Integrations & API Keys</h3>
            </div>
            
            <div className="bg-background-card border border-border rounded-xl p-8 space-y-8">
              <div className="space-y-4">
                <div className="p-4 bg-status-info-bg border border-status-info/20 rounded-lg flex items-start space-x-3">
                   <Clock size={18} className="text-status-info mt-0.5" />
                   <p className="text-xs text-status-info leading-relaxed">
                     These keys are used to connect to Vapi.ai and OpenAI. Ensure they have sufficient credits to avoid call failures.
                   </p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted">Vapi API Key</label>
                  <input 
                    type="password" 
                    value={settings.vapi_api_key}
                    onChange={(e) => updateSetting('vapi_api_key', e.target.value)}
                    className="w-full bg-background-secondary border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted">OpenAI API Key</label>
                  <input 
                    type="password" 
                    value={settings.openai_api_key}
                    onChange={(e) => updateSetting('openai_api_key', e.target.value)}
                    className="w-full bg-background-secondary border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent-primary"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Prompt Editor Section */}
          <section id="prompt" className="space-y-6 pt-6 border-t border-border/50">
            <div className="flex items-center space-x-3 mb-2">
               <div className="p-2 bg-background-card border border-border rounded-lg text-text-muted">
                 <Headphones size={20} />
               </div>
               <h3 className="text-xl font-bold text-text-primary">AI Conversation Prompt</h3>
            </div>
            
            <div className="bg-background-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 bg-background-secondary border-b border-border flex items-center justify-between">
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Base System Instructions</span>
                <span className="text-[10px] bg-accent-glow text-accent-primary px-2 py-0.5 rounded uppercase font-bold tracking-widest">Master Prompt</span>
              </div>
              <textarea 
                value={settings.conversation_prompt}
                onChange={(e) => updateSetting('conversation_prompt', e.target.value)}
                rows="12"
                className="w-full bg-transparent p-8 text-sm font-mono text-text-secondary leading-relaxed focus:outline-none custom-scrollbar resize-none"
              ></textarea>
              <div className="p-4 bg-background-secondary/30 border-t border-border text-[11px] text-text-muted italic">
                Tip: Dynamic variables like {"{client_name}"} and {"{follow_up_context}"} will be automatically injected.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
