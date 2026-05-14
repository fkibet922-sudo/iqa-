import React, { useContext, useState } from 'react';
import { DataContext } from '../contexts/DataContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UploadCloud, 
  Trash2, 
  Image as ImageIcon, 
  Settings2, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

const SettingsManagement: React.FC = () => {
  const { logo, setLogo } = useContext(DataContext);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        setMessage({ text: 'Please upload a valid image file.', type: 'error' });
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        setMessage({ text: 'Logo exceeds the 2MB limit.', type: 'error' });
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
      setMessage({ text: 'Branding assets updated successfully!', type: 'success' });
      setTimeout(() => setMessage(null), 4000);
    };
    reader.onerror = () => {
        setMessage({ text: 'Failed to process image file.', type: 'error' });
    };
    reader.readAsDataURL(file);
  };
  
  const handleRemoveLogo = () => {
    setLogo(null);
    setMessage({ text: 'Institutional logo removed.', type: 'success' });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <Settings2 size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">System Configuration</h2>
          <p className="text-sm text-slate-500 font-medium">Control global branding and reporting settings</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Logo Upload */}
        <section className="bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-200/50 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-20 h-20 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-center justify-center text-slate-300">
            <UploadCloud size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 leading-tight">Institutional Branding</h3>
            <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">
              Upload a high-resolution logo (PNG/SVG) to appear on all official PDF log certificates.
            </p>
          </div>
          
          <label className="relative cursor-pointer group">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
            />
            <div className="btn-primary py-4 px-10 group-hover:scale-105 transition-transform">
              <UploadCloud size={18} /> Choose Assets
            </div>
          </label>
        </section>

        {/* Logo Preview */}
        <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col space-y-8 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Branding Preview</h3>
            {logo && (
              <button 
                onClick={handleRemoveLogo}
                className="text-rose-500 hover:text-rose-700 transition-colors"
                title="Remove Assets"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-slate-50/80 rounded-3xl border-2 border-dashed border-slate-200 p-8 min-h-[200px]">
            {logo ? (
              <motion.img 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src={logo} 
                alt="Institutional Logo" 
                className="max-h-32 max-w-full object-contain drop-shadow-lg" 
              />
            ) : (
              <div className="text-center space-y-2">
                <ImageIcon size={48} className="mx-auto text-slate-200" strokeWidth={1} />
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest leading-none">Generic Placeholder</p>
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 -mx-10 -mb-10 p-6 px-10">
            <ShieldCheck size={14} className="text-indigo-400" />
            Active Branding for Official Documentation
          </div>
        </section>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold max-w-md mx-auto justify-center ${
              message.type === 'success' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-rose-50 text-rose-600 border-rose-100'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsManagement;
