import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, Server, Database, Globe, Zap, Cpu, RefreshCw, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';

export default function SystemStatus() {
    const { t } = useTranslation();
    const [health, setHealth] = useState({
        loading: true,
        ready: false,
        checks: {},
        requestId: null,
        error: null,
        checkedAt: null,
    });

    useEffect(() => {
        document.dir = t('dir', 'ltr');
    }, [t]);

    useEffect(() => {
        let mounted = true;

        const loadHealth = async () => {
            try {
                const response = await apiClient.get('/ready');
                if (!mounted) {
                    return;
                }

                setHealth({
                    loading: false,
                    ready: Boolean(response.data?.success),
                    checks: response.data?.checks ?? {},
                    requestId: response.data?.request_id ?? null,
                    error: null,
                    checkedAt: new Date().toISOString(),
                });
            } catch (error) {
                if (!mounted) {
                    return;
                }

                setHealth({
                    loading: false,
                    ready: false,
                    checks: error?.response?.data?.checks ?? {},
                    requestId: error?.response?.data?.request_id ?? null,
                    error: error?.response?.data?.message ?? error.message ?? 'Unable to load status.',
                    checkedAt: new Date().toISOString(),
                });
            }
        };

        loadHealth();
        const timer = window.setInterval(loadHealth, 30000);

        return () => {
            mounted = false;
            window.clearInterval(timer);
        };
    }, []);

    const checkedLabel = health.checkedAt
        ? `Live check: ${new Date(health.checkedAt).toLocaleString()}`
        : t('status_page.loading', 'Checking live status...');

    const systems = useMemo(() => {
        const statusLabel = (check, fallback = 'operational') => {
            if (health.loading) {
                return t('status_page.states.maintenance', 'checking');
            }

            return check?.ok
                ? t('status_page.states.operational', 'operational')
                : t('status_page.states.degraded', fallback);
        };

        return [
            { name: t('status_page.systems.api'), status: health.ready ? t('status_page.states.operational', 'operational') : statusLabel(health.checks.database, 'degraded'), uptime: health.checks.database?.ok ? '100%' : 'degraded', icon: Server, color: health.checks.database?.ok ? 'text-emerald-500' : 'text-amber-500', bg: health.checks.database?.ok ? 'bg-emerald-500/10' : 'bg-amber-500/10' },
            { name: t('status_page.systems.ai'), status: statusLabel(health.checks.ai, 'degraded'), uptime: health.checks.ai?.ok ? '100%' : 'degraded', icon: Cpu, color: health.checks.ai?.ok ? 'text-emerald-500' : 'text-amber-500', bg: health.checks.ai?.ok ? 'bg-emerald-500/10' : 'bg-amber-500/10' },
            { name: t('status_page.systems.scraping'), status: statusLabel(health.checks.scraper, 'degraded'), uptime: health.checks.scraper?.ok ? '100%' : 'degraded', icon: Globe, color: health.checks.scraper?.ok ? 'text-emerald-500' : 'text-amber-500', bg: health.checks.scraper?.ok ? 'bg-emerald-500/10' : 'bg-amber-500/10' },
            { name: t('status_page.systems.db'), status: statusLabel(health.checks.database, 'degraded'), uptime: health.checks.database?.ok ? '100%' : 'degraded', icon: Database, color: health.checks.database?.ok ? 'text-emerald-500' : 'text-amber-500', bg: health.checks.database?.ok ? 'bg-emerald-500/10' : 'bg-amber-500/10' },
            { name: t('status_page.systems.analytics'), status: statusLabel(health.checks.cache, 'degraded'), uptime: health.checks.cache?.ok ? '100%' : 'degraded', icon: Activity, color: health.checks.cache?.ok ? 'text-emerald-500' : 'text-amber-500', bg: health.checks.cache?.ok ? 'bg-emerald-500/10' : 'bg-amber-500/10' },
            { name: t('status_page.systems.websockets'), status: t('status_page.states.maintenance', 'maintenance'), uptime: 'planned', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' }
        ];
    }, [health, t]);

    const incidents = [
        { date: t('status_page.incidents.i1_date'), title: t('status_page.incidents.i1_title'), status: t('status_page.states.completed'), type: 'maintenance' },
        { date: t('status_page.incidents.i2_date'), title: t('status_page.incidents.i2_title'), status: t('status_page.states.resolved'), type: 'incident' },
        { date: t('status_page.incidents.i3_date'), title: t('status_page.incidents.i3_title'), status: t('status_page.states.resolved'), type: 'incident' }
    ];

    return (
        <div className="min-h-screen relative overflow-hidden font-sans pt-32 pb-20 px-4 hud-scanner">
            <div className="fluid-bg-container">
                <div className="fluid-blob w-[500px] h-[500px] bg-indigo-500 top-[-10%] left-[-10%]" />
                <div className="fluid-blob w-[400px] h-[400px] bg-emerald-500 bottom-[20%] right-[-5%] animation-delay-2000" />
                <div className="fluid-blob w-[600px] h-[600px] bg-blue-400 top-[40%] left-[30%] opacity-10" />
            </div>
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] -z-10" 
                 style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <div className="max-w-5xl mx-auto space-y-16 relative z-10">
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-10 md:p-14 border-emerald-500/20 relative overflow-hidden shadow-2xl"
                >
                    <div className="noise-overlay"></div>
                    <div className="absolute top-0 right-0 p-12 text-emerald-500/5 -z-10">
                        <Activity size={300} strokeWidth={0.5} />
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="space-y-6 text-center md:text-left">
                            <motion.div 
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="inline-flex items-center gap-3 px-5 py-2 glass-card !rounded-full border-emerald-500/20 bg-emerald-500/5 shadow-inner"
                            >
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">{t('status_page.live_status')}</span>
                            </motion.div>
                            
                            <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter">
                                {t('status_page.title')}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                {health.loading ? t('status_page.loading', 'Checking live status...') : (health.error || checkedLabel)}
                            </p>
                        </div>
                        
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn-primary !px-10 !py-5 !rounded-2xl shrink-0 gap-3 border border-emerald-500/30 shadow-emerald-500/10 group"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw size={22} className="group-hover:rotate-180 transition-transform duration-500" />
                            {t('status_page.refresh')}
                        </motion.button>
                    </div>
                </motion.div>

                <div className="space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <div className="h-px flex-grow bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">Core Infrastructure</h2>
                        <div className="h-px flex-grow bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {systems.map((s, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-card p-8 group hover:border-indigo-500/30 transition-all border-slate-200/50 dark:border-slate-800 relative overflow-hidden"
                            >
                                <div className="noise-overlay"></div>
                                <div className="flex flex-col gap-6 relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div className={`w-14 h-14 ${s.bg} rounded-2xl flex items-center justify-center ${s.color} shadow-inner`}>
                                            <s.icon size={26} />
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${s.color.replace('text-', 'bg-')} animate-pulse`} />
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">{s.status}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{s.uptime} uptime</span>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {s.name}
                                    </h3>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="space-y-10 pt-10">
                    <div className="flex justify-between items-center px-4">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('status_page.past_events')}</h2>
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">90 DAY ARCHIVE</div>
                    </div>
                    
                    <div className="space-y-6">
                        {incidents.map((inc, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-slate-200/50 dark:border-slate-800 group"
                            >
                                <div className="flex items-start gap-6">
                                    <div className={`mt-1.5 w-3 h-3 rounded-full shrink-0 ${inc.type === 'maintenance' ? 'bg-indigo-500' : 'bg-rose-500'} shadow-[0_0_15px_rgba(99,102,241,0.5)]`} />
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md ${inc.type === 'maintenance' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                                {inc.type}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-400">{inc.date}</span>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-white group-hover:translate-x-1 transition-transform">{inc.title}</h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 glass-card !rounded-xl text-emerald-500 font-black text-xs uppercase tracking-widest border-emerald-500/10">
                                    <CheckCircle2 size={16} /> {inc.status}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="text-center pt-20">
                        <div className="inline-flex items-center gap-3 px-6 py-3 glass-card !rounded-2xl border-white/10 dark:border-white/5 bg-white/5 text-slate-500 dark:text-slate-400 text-xs font-bold">
                        <AlertCircle size={14} className="text-indigo-500" />
                        {health.requestId ? `Request ${health.requestId}` : 'Automated infrastructure monitoring powered by Career Compass AI'}
                     </div>
                </div>

            </div>

             <style dangerouslySetInnerHTML={{ __html: `
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.1); }
                }
                .pulse-slow {
                    animation: pulse-slow 4s infinite ease-in-out;
                }
            `}} />
        </div>
    );
}
