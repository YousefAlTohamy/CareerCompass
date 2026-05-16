import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  RefreshCw, Target, Award, Zap, Compass, Activity, Globe, Eye
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import { cvAPI } from "../../api/endpoints";
import ProcessingAnimation from "../../components/ProcessingAnimation";
import { CareerIdentityCard } from "../../components/AiInsights";
import HUDLayout from "../../components/HUDLayout";

const formatExperienceYears = (years, t) => {
  if (years == null) return null;
  const n = Number(years);
  return `${n} ${n === 1 ? t('dashboard.year') : t('dashboard.years')}`;
};

const CV_UPLOAD_RECOVERY_ATTEMPTS = 8;
const CV_UPLOAD_RECOVERY_DELAY_MS = 3000;
const CV_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const CV_UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const CV_UPLOAD_ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const CV_UPLOAD_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const INTERNAL_CV_URL_HOSTS = new Set([
  "minio",
  "db",
  "backend-api",
  "ai-cv-analyzer",
  "ai-job-miner",
  "nginx",
]);

const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const hasAllowedCvExtension = (name = "") => {
  const lowerName = name.toLowerCase();
  return CV_UPLOAD_ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
};

const isBrowserSafeCvUrl = (url) => {
  if (!url) return false;

  try {
    const parsed = new URL(url, window.location.origin);
    return !INTERNAL_CV_URL_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const validateCvFile = (file) => {
  if (!file) return null;

  if (file.size > CV_UPLOAD_MAX_BYTES) {
    return "Please upload a CV file that is 5 MB or smaller.";
  }

  if (!CV_UPLOAD_ALLOWED_TYPES.has(file.type) && !hasAllowedCvExtension(file.name)) {
    return "Unsupported CV file. Upload a PDF, JPG, JPEG, or PNG file.";
  }

  return null;
};

const uploadErrorMessage = (error) => {
  const data = error?.response?.data;
  const validationMessage = data?.errors?.cv?.[0];
  if (validationMessage) return validationMessage;
  return data?.message || "CV upload failed. Please try again.";
};

const cvAnalysisFingerprint = (candidate) => {
  const analysis = candidate?.cv_analysis;
  if (!analysis) return null;

  return [
    analysis.updated_at,
    analysis.created_at,
    analysis.cv_file?.uploaded_at,
    analysis.cv_file?.path,
    analysis.cv_file?.sha256,
    analysis.parsing_status,
  ].filter(Boolean).join('|') || 'analysis-present';
};

const isRecoverableUploadError = (error) => {
  if (!error?.response) return true;
  return [408, 502, 504].includes(Number(error.response.status));
};

const feedbackForParsingStatus = (payload, parsingStatus) => {
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];

  if (["timeout", "error"].includes(parsingStatus)) {
    return {
      type: "warning",
      message: payload?.message || "Your CV was uploaded, but AI parsing did not fully complete. Existing profile details were preserved.",
    };
  }

  if (["empty_file", "no_text"].includes(parsingStatus)) {
    return {
      type: "warning",
      message: payload?.message || "Your CV was uploaded, but no readable text was extracted. Try a text-based PDF or a clearer image.",
    };
  }

  if (parsingStatus === "partial_success") {
    return {
      type: "warning",
      message: payload?.message || "CV uploaded with partial analysis. Please review the extracted profile details.",
    };
  }

  if (warnings.some((warning) => warning.code === "no_skills_extracted")) {
    return {
      type: "warning",
      message: "CV uploaded, but no skills were extracted. Existing skills were preserved.",
    };
  }

  if (parsingStatus === "ocr_fallback") {
    return {
      type: "warning",
      message: "CV parsed using OCR fallback. Please review your extracted profile details.",
    };
  }

  return {
    type: "success",
    message: "CV parsed successfully. Your profile and skills were refreshed.",
  };
};

const ProfileCompletenessRing = ({ score }) => {
  const safeScore = Math.min(100, Math.max(0, score || 0));
  const circumference = 2 * Math.PI * 32;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;
  return (
    <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="32" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-white/5 transition-colors" />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          cx="36" cy="36" r="32" fill="none" stroke="#6366f1" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference}
          className="drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-black text-slate-900 dark:text-white">{Math.round(safeScore)}%</span>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);

  useEffect(() => { 
    refreshUser().catch(() => {}); 
    loadSkills(); 
    // Set document direction
    document.dir = t('dir', 'ltr');
  }, [t, refreshUser]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const response = await cvAPI.getUserSkills();
      const payload = response?.data?.data ?? response?.data ?? [];
      const skillData = Array.isArray(payload) ? payload : (payload.skills ?? []);
      setSkills(Array.isArray(skillData) ? skillData : []);
    } catch (error) { 
      console.error(error); 
      setSkills([]);
    } finally { 
      setLoading(false); 
    }
  };

  const recoverPersistedCvAnalysis = async (previousFingerprint) => {
    for (let attempt = 0; attempt < CV_UPLOAD_RECOVERY_ATTEMPTS; attempt += 1) {
      await delay(CV_UPLOAD_RECOVERY_DELAY_MS);

      const freshUser = await refreshUser();
      await loadSkills();
      const nextFingerprint = cvAnalysisFingerprint(freshUser);

      if (nextFingerprint && nextFingerprint !== previousFingerprint) {
        return freshUser;
      }
    }

    return null;
  };

  const handleCVUpload = async (e) => {
    if (uploading || isDiscovering) return;

    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    const validationError = validateCvFile(file);
    if (validationError) {
      setUploadFeedback({
        type: "error",
        message: validationError,
      });
      input.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("cv", file);
    const previousFingerprint = cvAnalysisFingerprint(user);

    try {
      setUploading(true);
      setIsDiscovering(false);
      setUploadFeedback({
        type: "info",
        message: "Your CV is being analyzed. The first AI run may take longer; do not refresh this page.",
      });

      const response = await cvAPI.uploadCV(formData);
      const payload = response?.data ?? {};
      const parsingStatus = payload.parsing_status || payload.user?.cv_analysis?.parsing_status || "success";

      await refreshUser();
      setUploadFeedback(feedbackForParsingStatus(payload, parsingStatus));

      if (payload.is_new_role) {
        setIsDiscovering(true);
        setUploadFeedback({
          type: "info",
          message: "CV saved. Market discovery has started for your role; jobs may appear in a few moments.",
        });
        window.setTimeout(() => setIsDiscovering(false), 10000);
      }

      loadSkills();
    } catch (error) {
      console.error(error);

      if (isRecoverableUploadError(error)) {
        setUploadFeedback({
          type: "info",
          message: "Analysis is still being checked. Please wait while we verify whether your CV was saved.",
        });

        const recoveredUser = await recoverPersistedCvAnalysis(previousFingerprint);
        if (recoveredUser?.cv_analysis) {
          const parsingStatus = recoveredUser.cv_analysis.parsing_status || "success";
          const recoveredFeedback = feedbackForParsingStatus({ user: recoveredUser }, parsingStatus);

          setUploadFeedback({
            ...recoveredFeedback,
            message: `${recoveredFeedback.message} The upload recovered successfully after the browser request timed out.`,
          });
          return;
        }

        setUploadFeedback({
          type: "warning",
          message: "The upload request timed out while analysis may still be running. Check this dashboard again shortly before retrying.",
        });
        return;
      }

      setUploadFeedback({
        type: "error",
        message: uploadErrorMessage(error),
      });
    } finally {
      setUploading(false);
      if (input) input.value = "";
    }
  };

  const hasCvAnalysis = user?.cv_analysis != null;
  const completenessScore = Number(user?.cv_analysis?.completeness_score) || 0;
  const totalExperience = user?.profile?.total_experience_years ?? user?.total_experience_years;
  const uploadDisabled = uploading || isDiscovering;
  const safeCvUrl = isBrowserSafeCvUrl(user?.cv_url) ? user.cv_url : null;

  return (
    <HUDLayout loading={loading || uploading} loadingType={uploading ? "scanning" : "standard"}>
      <div className="max-w-7xl mx-auto px-4 pt-32 space-y-10 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-white/5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                <span className="micro-typography text-emerald-600 dark:text-emerald-400">{t('hud_labels.core_systems')}: {t('hud_labels.active')}</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter leading-none">
              {t('dashboard.welcome', { name: (user?.name || "User").split(" ")[0] })}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
             {safeCvUrl && (
               <a 
                 href={safeCvUrl} target="_blank" rel="noopener noreferrer"
                 className="glass-card !rounded-2xl px-6 py-3 flex items-center gap-3 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 group shadow-xl shadow-emerald-500/10"
               >
                 <Eye size={18} className="text-emerald-600 dark:text-emerald-400" />
                 <div className="flex flex-col items-start">
                    <span className="micro-typography text-emerald-600 dark:text-emerald-400 font-black">{t('cv_analyzer.view', 'VIEW_CV')}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('hud_labels.stored_file', 'STORED_FILE')}</span>
                 </div>
               </a>
             )}
             <label className={`glass-card !rounded-2xl px-6 py-3 flex items-center gap-3 border-indigo-500/30 bg-indigo-500/5 backdrop-blur-md transition-all group shadow-xl shadow-indigo-500/10 ${uploadDisabled ? "opacity-60 cursor-not-allowed" : "hover:bg-indigo-500/10 cursor-pointer hover:scale-105 active:scale-95"}`}>
                <input type="file" accept={CV_UPLOAD_ACCEPT} className="hidden" onChange={handleCVUpload} disabled={uploadDisabled} />
                <RefreshCw size={18} className="text-indigo-600 dark:text-indigo-400 group-hover:rotate-180 transition-transform duration-500" />
                <div className="flex flex-col items-start">
                   <span className="micro-typography text-indigo-600 dark:text-indigo-400 font-black">{uploadDisabled ? t('cv_analyzer.processing', 'PROCESSING') : t('cv_analyzer.update', 'UPDATE_CV')}</span>
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('hud_labels.sync_core', 'SYNC_CORE')}</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">PDF/JPG/PNG UP TO 5MB</span>
                </div>
             </label>
             <div className="glass-card !rounded-2xl px-6 py-3 flex flex-col items-center border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-md min-w-[100px]">
                <span className="micro-typography text-slate-500 mb-1">PROFILE SCORE</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{Math.round(completenessScore)}%</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-center">CV completeness</span>
             </div>
          </div>
        </div>

        {uploadFeedback && (
          <div className={`rounded-3xl border px-6 py-4 text-sm font-bold ${
            uploadFeedback.type === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : uploadFeedback.type === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : uploadFeedback.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
          }`}>
            {uploadFeedback.message}
          </div>
        )}

        {!hasCvAnalysis ? (
           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-12 md:p-20 text-center border-indigo-500/20 bg-white/80 dark:bg-white/5 backdrop-blur-xl">
              <div className="max-w-2xl mx-auto space-y-8">
                  <div className="w-24 h-24 glass-card !rounded-full flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 border-indigo-500/20 shadow-xl bg-white dark:bg-slate-900">
                    <Compass size={48} className="animate-spin-slow" />
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black leading-none">{t('cv_analyzer.title')}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xl font-medium">{t('cv_analyzer.upload')}</p>
                  <label className={`inline-block ${uploadDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
                    <input type="file" accept={CV_UPLOAD_ACCEPT} className="hidden" onChange={handleCVUpload} disabled={uploadDisabled} />
                    <div className={`px-12 py-6 text-white font-black text-xl rounded-3xl transition-all shadow-2xl ${uploadDisabled ? "bg-slate-400" : "bg-indigo-600 hover:bg-indigo-500"}`}>
                        {uploadDisabled ? t('cv_analyzer.processing', 'Processing...') : t('cv_analyzer.analyze')}
                    </div>
                  </label>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    PDF, JPG, or PNG up to 5 MB. Scanned files may use OCR and take longer.
                  </p>
              </div>
           </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
             <div className="md:col-span-8"><CareerIdentityCard cvAnalysis={user?.cv_analysis} /></div>
             <div className="md:col-span-4 space-y-8">
                <div className="glass-card p-8 border-slate-200 dark:border-white/5 bg-white/80 dark:bg-white/5 backdrop-blur-md flex items-center gap-6">
                    <ProfileCompletenessRing score={completenessScore} />
                    <div>
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="micro-typography text-slate-500">{t('dashboard.profile_completeness')}</h3>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{Math.round(completenessScore)}%</p>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
                          Derived from your parsed CV fields, extracted skills, and profile completeness.
                        </p>
                    </div>
                </div>
                <div className="glass-card p-8 border-slate-200 dark:border-white/5 bg-white/80 dark:bg-white/5 backdrop-blur-md flex items-center gap-6">
                    <div className="w-16 h-16 glass-card !rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-lg"><Activity size={32} /></div>
                    <div>
                        <h3 className="micro-typography text-slate-500 mb-1">{t('dashboard.total_experience')}</h3>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{formatExperienceYears(totalExperience, t) ?? "N/A"}</p>
                    </div>
                </div>
                <div className="glass-card p-8 border-indigo-500/20 bg-indigo-500/5 backdrop-blur-xl relative group overflow-hidden">
                    <Zap size={60} className="absolute -right-4 -bottom-4 text-indigo-500/10 group-hover:text-indigo-500/20 transition-colors" />
                    <h3 className="micro-typography text-indigo-600 dark:text-indigo-400 mb-4">{t('dashboard.next_action')}</h3>
                    <h4 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">{t('dashboard.ready_bridge')}</h4>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
                      Recommendations use imported jobs and your CV role. If market discovery just started, jobs may refresh after the scraping worker finishes.
                    </p>
                    <Link to="/jobs" className="w-full flex items-center justify-center py-4 bg-indigo-600 rounded-2xl font-black text-sm hover:translate-y-[-2px] transition-transform shadow-xl shadow-indigo-500/20 text-white">
                        {t('dashboard.start_gap')}
                    </Link>
                </div>
             </div>
             <div className="md:col-span-12 glass-card p-10 border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-xl">
                 <div className="flex justify-between items-center mb-10">
                    <div className="space-y-1">
                       <h3 className="text-3xl font-black text-slate-900 dark:text-white">{t('dashboard.skills')}</h3>
                       <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
                         <span className="micro-typography text-slate-500">{t('hud_labels.neural_net_mapping', 'NEURAL_NET_MAPPING')}</span>
                       </div>
                    </div>
                    <div className="text-xs font-black px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400">
                       {t('dashboard.tracked_count', { count: (skills || []).length })}
                    </div>
                 </div>
                 <div className="flex flex-wrap gap-4">
                    {Array.isArray(skills) && skills.map((s, idx) => {
                      const skillName = (typeof s === 'string') ? s : (s?.name || s?.title || 'Unknown');
                      return (
                        <div key={idx} className="px-4 py-2 glass-card !rounded-xl border-slate-200 dark:border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-indigo-400 bg-white/50 dark:bg-white/5">
                           {skillName}
                        </div>
                      );
                    })}
                    {(!skills || skills.length === 0) && (
                      <p className="text-slate-400 text-xs italic">{t('dashboard.no_skills')}</p>
                    )}
                 </div>
             </div>
          </div>
        )}
      </div>
    </HUDLayout>
  );
}
