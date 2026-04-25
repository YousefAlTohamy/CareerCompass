import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import CustomCursor from '../components/CustomCursor';
import '../styles/compass.css';

gsap.registerPlugin(ScrollTrigger);

/* ════════════════════════════════════════════════════════════════════════════
   §1  GSAP Cinematic Preloader
   ════════════════════════════════════════════════════════════════════════════ */
const Preloader = ({ onComplete }) => {
  const needleRef = useRef(null);
  const barRef = useRef(null);
  const percentRef = useRef(null);
  const wrapRef = useRef(null);
  const shutterL = useRef(null);
  const shutterR = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        // Shutter split effect
        const exit = gsap.timeline({ onComplete });
        exit.to(needleRef.current, { rotation: 0, duration: 0.2, ease: 'power3.out' });
        exit.to(shutterL.current, { x: '-100%', duration: 0.4, ease: 'power4.inOut' }, 0.1);
        exit.to(shutterR.current, { x: '100%', duration: 0.4, ease: 'power4.inOut' }, 0.1);
        exit.to(wrapRef.current, { opacity: 0, duration: 0.2 }, 0.4);
      }
    });

    // Spin needle
    gsap.to(needleRef.current, { rotation: 720, duration: 0.8, ease: 'power2.inOut', repeat: 0 });

    // Progress bar
    tl.to(barRef.current, {
      width: '100%',
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: function () {
        const p = Math.round(this.progress() * 100);
        if (percentRef.current) percentRef.current.textContent = `${p}%`;
      }
    });
  }, [onComplete]);

  return (
    <div ref={wrapRef} className="cc-preloader">
      <div ref={shutterL} className="cc-preloader__shutter-left" />
      <div ref={shutterR} className="cc-preloader__shutter-right" />
      {/* Compass Needle SVG */}
      <svg ref={needleRef} className="cc-preloader__needle" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="38" stroke="rgba(0,210,255,0.15)" strokeWidth="1" />
        <circle cx="40" cy="40" r="28" stroke="rgba(0,210,255,0.08)" strokeWidth="0.5" />
        <polygon points="40,8 46,44 40,50 34,44" fill="url(#needleGrad)" />
        <polygon points="40,72 46,44 40,38 34,44" fill="rgba(157,80,187,0.5)" />
        <circle cx="40" cy="40" r="4" fill="#00D2FF" />
        <circle cx="40" cy="40" r="6" stroke="#00D2FF" strokeWidth="0.5" fill="none" opacity="0.5" />
        <defs>
          <linearGradient id="needleGrad" x1="40" y1="8" x2="40" y2="50">
            <stop offset="0%" stopColor="#00D2FF" />
            <stop offset="100%" stopColor="#9D50BB" />
          </linearGradient>
        </defs>
      </svg>
      <div className="cc-preloader__progress-track">
        <div ref={barRef} className="cc-preloader__progress-bar" />
      </div>
      <div ref={percentRef} className="cc-preloader__percent">0%</div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   §2  Magnetic Button Component
   ════════════════════════════════════════════════════════════════════════════ */
const MagneticButton = ({ children, className = '', href, ...props }) => {
  const btnRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.4, ease: 'power2.out' });
  }, []);

  const handleMouseLeave = useCallback(() => {
    gsap.to(btnRef.current, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
  }, []);

  const Tag = href ? Link : 'button';
  return (
    <Tag
      ref={btnRef}
      to={href}
      className={`cc-btn-magnetic ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Tag>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   §3  Glow Orbs Background (Optimized)
   ════════════════════════════════════════════════════════════════════════════ */
const GlowOrbs = React.memo(() => {
  const orbsRef = useRef([]);

  useEffect(() => {
    orbsRef.current.forEach((orb) => {
      if (!orb) return;
      gsap.to(orb, {
        duration: gsap.utils.random(4, 7),
        x: 'random(-60, 60)',
        y: 'random(-60, 60)',
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });
  }, []);

  const orbs = [
    { w: 300, h: 300, bg: '#00D2FF', top: '10%', left: '10%', opacity: 0.15 },
    { w: 400, h: 400, bg: '#9D50BB', top: '50%', right: '5%', opacity: 0.12 },
    { w: 250, h: 250, bg: '#00D2FF', bottom: '20%', left: '40%', opacity: 0.1 },
  ];

  return (
    <>
      {orbs.map((o, i) => (
        <div
          key={i}
          ref={(el) => (orbsRef.current[i] = el)}
          className="cc-glow-orb"
          style={{
            width: o.w, height: o.h, background: o.bg,
            top: o.top, left: o.left, right: o.right, bottom: o.bottom,
            opacity: o.opacity,
          }}
        />
      ))}
    </>
  );
});

/* ════════════════════════════════════════════════════════════════════════════
   §4  Radial Compass Navigation (Mobile)
   ════════════════════════════════════════════════════════════════════════════ */
const CompassNav = () => {
  const [open, setOpen] = useState(false);
  const items = [
    { icon: 'ph-thin ph-house', href: '#hero', angle: -135 },
    { icon: 'ph-thin ph-cpu', href: '#blueprint', angle: -90 },
    { icon: 'ph-thin ph-map-trifold', href: '#roadmap', angle: -45 },
    { icon: 'ph-thin ph-envelope', href: '#contact', angle: 0 },
  ];
  const radius = 80;

  const scrollTo = (id) => {
    setOpen(false);
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <div className={`cc-radial-menu ${open ? 'open' : ''}`}>
        {items.map((item, i) => {
          const rad = (item.angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          return (
            <button
              key={i}
              className="cc-radial-item"
              style={{
                bottom: 6 + -y,
                right: 6 + -x,
                transitionDelay: open ? `${i * 0.06}s` : '0s',
              }}
              onClick={() => scrollTo(item.href)}
            >
              <i className={item.icon} />
            </button>
          );
        })}
      </div>
      <button
        className={`cc-compass-trigger ${open ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Navigation menu"
      >
        <i className="ph-thin ph-compass" style={{ fontSize: 26 }} />
      </button>
    </>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   §5  SKILL DATA
   ════════════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const heroRef = useRef(null);
  const splineRef = useRef(null);
  const roadmapRef = useRef(null);
  const skillsRef = useRef(null);
  const isRtl = i18n.language === 'ar';

  const SKILLS = React.useMemo(() => [
    { icon: 'ph-thin ph-brain', label: t('home.skills.s1_label'), sub: t('home.skills.s1_sub') },
    { icon: 'ph-thin ph-code', label: t('home.skills.s2_label'), sub: t('home.skills.s2_sub') },
    { icon: 'ph-thin ph-cloud', label: t('home.skills.s3_label'), sub: t('home.skills.s3_sub') },
    { icon: 'ph-thin ph-database', label: t('home.skills.s4_label'), sub: t('home.skills.s4_sub') },
    { icon: 'ph-thin ph-shield-check', label: t('home.skills.s5_label'), sub: t('home.skills.s5_sub') },
    { icon: 'ph-thin ph-figma-logo', label: t('home.skills.s6_label'), sub: t('home.skills.s6_sub') },
    { icon: 'ph-thin ph-git-branch', label: t('home.skills.s7_label'), sub: t('home.skills.s7_sub') },
    { icon: 'ph-thin ph-chart-line-up', label: t('home.skills.s8_label'), sub: t('home.skills.s8_sub') },
    { icon: 'ph-thin ph-cube', label: t('home.skills.s9_label'), sub: t('home.skills.s9_sub') },
  ], [t]);

  const PROJECTS = React.useMemo(() => [
    { title: t('home.projects.p1_title'), desc: t('home.projects.p1_desc'), tags: ['Python', 'NLP', 'FastAPI'] },
    { title: t('home.projects.p2_title'), desc: t('home.projects.p2_desc'), tags: ['React', 'D3.js', 'GraphQL'] },
    { title: t('home.projects.p3_title'), desc: t('home.projects.p3_desc'), tags: ['TensorFlow', 'Python', 'REST'] },
    { title: t('home.projects.p4_title'), desc: t('home.projects.p4_desc'), tags: ['Node.js', 'PDF.js', 'AI'] },
    { title: t('home.projects.p5_title'), desc: t('home.projects.p5_desc'), tags: ['ML', 'Analytics', 'Python'] },
    { title: t('home.projects.p6_title'), desc: t('home.projects.p6_desc'), tags: ['GPT-4', 'WebRTC', 'React'] },
  ], [t]);

  /* ── After preloader, set loaded flag ────────────────────────────────── */
  const handlePreloaderComplete = useCallback(() => {
    setLoaded(true);
  }, []);

  // Mouse move handler for Bento Glow (Optimized with rAF)
  const bentoRaf = useRef(null);
  const handleBentoMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (bentoRaf.current) cancelAnimationFrame(bentoRaf.current);
    bentoRaf.current = requestAnimationFrame(() => {
      card.style.setProperty('--x', `${x}%`);
      card.style.setProperty('--y', `${y}%`);
    });
  };

  /* ── Hero entrance animations (after loaded → DOM exists) ────────────── */
  useEffect(() => {
    if (!loaded) return;
    // Scale Spline from 1.2→1.0
    if (splineRef.current) {
      gsap.fromTo(splineRef.current,
        { scale: 1.2, opacity: 0 },
        { scale: 1, opacity: 0.7, duration: 1.2, ease: 'power3.out' }
      );
    }
    // Fade in hero content
    gsap.fromTo('.cc-hero__content',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, delay: 0.1, ease: 'power3.out' }
    );
  }, [loaded]);

  /* ── GSAP ScrollTrigger animations ───────────────────────────────────── */
  useEffect(() => {
    if (!loaded) return;

    // Skills "scanning" entry
    gsap.from('.cc-skill-chip', {
      clipPath: 'inset(0 100% 0 0)',
      stagger: 0.1,
      duration: 0.6,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: skillsRef.current,
        start: 'top 75%',
      }
    });

    // Nexus slices entry
    gsap.from('.cc-nexus-slice', {
      y: 30,
      stagger: 0.1,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: roadmapRef.current,
        start: 'top 85%',
      }
    });

    // Contact fade-in
    gsap.from('.cc-terminal__form', {
      y: 60, opacity: 0, duration: 0.8,
      scrollTrigger: { trigger: '#contact', start: 'top 80%' }
    });

    return () => ScrollTrigger.getAll().forEach(st => st.kill());
  }, [loaded]);

  /* ── Floating timeline for Spline ────────────────────────────────────── */
  useEffect(() => {
    if (!loaded || !splineRef.current) return;
    gsap.to(splineRef.current, {
      y: -15, duration: 3, repeat: -1, yoyo: true, ease: 'sine.inOut'
    });
  }, [loaded]);

  if (!loaded) {
    return <Preloader onComplete={handlePreloaderComplete} />;
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <CustomCursor />
      <GlowOrbs />

      {/* ══════ §2 HERO SECTION ══════════════════════════════════════════════ */}
      <section id="hero" ref={heroRef} className="cc-hero">
        {/* CSS Animated Astrolabe/Compass */}
        <div ref={splineRef} className="cc-hero__css-animation">
          <div className="cc-astrolabe">
            <div className="cc-ring cc-ring-1"></div>
            <div className="cc-ring cc-ring-2"></div>
            <div className="cc-ring cc-ring-3"></div>
            <div className="cc-core">
              <div className="cc-core-inner"></div>
            </div>
            <div className="cc-orbit-dots">
              <div className="cc-dot cc-dot-1"></div>
              <div className="cc-dot cc-dot-2"></div>
              <div className="cc-dot cc-dot-3"></div>
            </div>
          </div>
        </div>

        <div className="cc-hero__content" style={{ opacity: 0 }}>
          <h1 className="cc-hero__headline" dangerouslySetInnerHTML={{ __html: t('home.hero.headline') }} />

          <p className="cc-hero__subtext">
            {t('home.hero.subtitle')}
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <MagneticButton href={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'}>
                {user.role === 'admin' ? t('home.hero.enterAdmin') : t('home.hero.enterTalent')}
                <i className="ph-thin ph-arrow-right" />
              </MagneticButton>
            ) : (
              <>
                <MagneticButton href="/register">
                  {t('home.hero.startNavigating')}
                  <i className="ph-thin ph-arrow-right" />
                </MagneticButton>
                <Link to="/login" className="cc-btn-secondary-ghost">
                  {t('home.hero.signInBtn')}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="cc-divider" />

      {/* ══════ §3 BLUEPRINT / ABOUT ═══════════════════════════════════════ */}
      <section id="blueprint" className="cc-blueprint">
        <div className="cc-blueprint__grid-bg" />

        <div className="cc-blueprint__header">
          <div className="cc-blueprint__label">{t('home.sections.blueprint_label')}</div>
          <h2 className="cc-blueprint__title">{t('home.sections.blueprint_title')}</h2>
        </div>

        <div ref={skillsRef} className="cc-skills-bento">
          {SKILLS.map((skill, i) => {
            // Assign some special bento classes for variety
            let bentoClass = '';
            if (i === 0) bentoClass = 'cc-bento-card--large';
            else if (i === 1) bentoClass = 'cc-bento-card--tall';
            else if (i === 4) bentoClass = 'cc-bento-card--wide';

            return (
              <div 
                key={i} 
                className={`cc-bento-card ${bentoClass}`}
                onMouseMove={handleBentoMouseMove}
              >
                <i className={`${skill.icon} cc-bento-card__icon`} />
                <div>
                  <div className="cc-bento-card__title">{skill.label}</div>
                  <div className="cc-bento-card__sub">{skill.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="cc-divider" />

      {/* ══════ §4 PROJECT BENTO GRID / ROADMAP ════════════════════════════ */}
      <section id="roadmap" ref={roadmapRef} className="cc-roadmap">
        <div className="cc-roadmap__glow" />
        <div className="cc-roadmap__header">
          <div className="cc-blueprint__label" style={{ color: 'var(--cc-primary)', opacity: 1 }}>{t('home.sections.nexus_label')}</div>
          <h2 className="cc-blueprint__title">{t('home.sections.nexus_title')}</h2>
        </div>

        <div className="cc-roadmap__nexus" style={{ minHeight: '480px' }}>
          {PROJECTS && PROJECTS.length > 0 ? PROJECTS.map((project, i) => (
            <div 
              key={i} 
              className="cc-nexus-slice"
              onMouseMove={handleBentoMouseMove}
            >
              <div className="cc-nexus-slice__visual" />
              
              <div className="cc-nexus-slice__collapsed">
                <div className="cc-nexus-slice__idx">{`0${i + 1}`}</div>
                <div className="cc-nexus-slice__title-side">{project.title}</div>
              </div>

              <div className="cc-nexus-slice__content">
                <div className="cc-nexus-slice__header">
                  <span className="cc-nexus-slice__idx-full">{`PROJECT 0${i + 1}`}</span>
                  <h3 className="cc-nexus-slice__title">{project.title}</h3>
                </div>
                <p className="cc-nexus-slice__desc">{project.desc}</p>
                <div className="cc-nexus-slice__tags">
                  {project.tags.map((tag, j) => (
                    <span key={j} className="cc-nexus-slice__tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )) : (
            <div className="w-full text-center py-24 text-slate-500 border border-dashed border-slate-700 rounded-3xl">
              <i className="ph-thin ph-warning text-4xl mb-4 block" />
              <p className="font-mono text-sm">// SYSTEM_ERROR: DATA_FETCH_FAILED</p>
              <p className="text-xs opacity-50 mt-2">لا توجد مشاريع ليتم عرضها حالياً</p>
            </div>
          )}
        </div>
      </section>

      <div className="cc-divider" />

      {/* ══════ §5 CONTACT / TERMINAL ══════════════════════════════════════ */}
      <section id="contact" className="cc-terminal">
        <div className="cc-blueprint__header">
          <div className="cc-blueprint__label">{t('home.sections.contact_label')}</div>
          <h2 className="cc-blueprint__title">{t('home.sections.contact_title')}</h2>
        </div>

        <div className="cc-terminal__form">
          <div className="cc-terminal__bar">
            <div className="cc-terminal__dot" style={{ background: '#ff5f57' }} />
            <div className="cc-terminal__dot" style={{ background: '#febc2e' }} />
            <div className="cc-terminal__dot" style={{ background: '#28c840' }} />
            <span style={{ fontFamily: 'var(--cc-mono)', fontSize: 11, color: 'var(--cc-text-tertiary)', marginLeft: 12 }}>
              career-compass ~ /contact
            </span>
          </div>

          <form className="cc-terminal__body" onSubmit={(e) => e.preventDefault()}>
            <div className="cc-terminal__field">
              <label>{t('home.contact.name_label')}</label>
              <input type="text" placeholder={t('home.contact.name_placeholder')} />
            </div>
            <div className="cc-terminal__field">
              <label>{t('home.contact.email_label')}</label>
              <input type="email" placeholder={t('home.contact.email_placeholder')} />
            </div>
            <div className="cc-terminal__field">
              <label>{t('home.contact.message_label')}</label>
              <textarea rows={4} placeholder={t('home.contact.message_placeholder')} />
            </div>
            <button type="submit" className="cc-terminal__submit">
              <i className="ph-thin ph-paper-plane-tilt" style={{ marginRight: 8 }} />
              {t('home.contact.submit_btn')}
            </button>
          </form>

          <div className="cc-terminal__sidebar">
            <div className="cc-terminal__header" style={{ marginBottom: 12 }}>
              <div className="cc-blueprint__label" style={{ marginBottom: 4 }}>{t('home.contact.status_header')}</div>
              <div style={{ fontFamily: 'var(--cc-mono)', fontSize: 12, color: 'var(--cc-primary)' }}>{t('home.contact.status_online')}</div>
            </div>
            
            <div className="cc-terminal__status-list">
              <div className="cc-terminal__status-item">
                <div>
                  <div className="cc-terminal__status-label">{t('home.contact.uplink_label')}</div>
                  <div className="cc-terminal__status-bar"><div className="cc-terminal__status-progress" style={{ width: '85%' }} /></div>
                </div>
                <div className="cc-terminal__status-value">{t('home.contact.uplink_active')}</div>
              </div>
              <div className="cc-terminal__status-item" style={{ marginTop: 16 }}>
                <div>
                  <div className="cc-terminal__status-label">{t('home.contact.encryption_label')}</div>
                  <div className="cc-terminal__status-bar"><div className="cc-terminal__status-progress" style={{ width: '100%', background: '#28c840' }} /></div>
                </div>
                <div className="cc-terminal__status-value">AES-256</div>
              </div>
              <div className="cc-terminal__status-item" style={{ marginTop: 16 }}>
                <div>
                  <div className="cc-terminal__status-label">{t('home.contact.latency_label')}</div>
                  <div className="cc-terminal__status-bar"><div className="cc-terminal__status-progress" style={{ width: '12%', background: '#febc2e' }} /></div>
                </div>
                <div className="cc-terminal__status-value">24ms</div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(0, 210, 255, 0.08)', paddingTop: 20 }}>
              <div className="cc-terminal__status-label" style={{ marginBottom: 8 }}>{t('home.contact.secure_port')}</div>
              <div style={{ fontFamily: 'var(--cc-mono)', fontSize: 10, color: 'var(--cc-text-tertiary)' }}>
                SSH-RSA 4096 <br/>
                CC-SERVER-ALPHA-01
              </div>
            </div>
          </div>
        </div>

        {/* Social Icons with Glitch */}
        <div className="cc-socials">
          {[
            { icon: 'ph-thin ph-github-logo', href: '#' },
            { icon: 'ph-thin ph-linkedin-logo', href: '#' },
            { icon: 'ph-thin ph-twitter-logo', href: '#' },
            { icon: 'ph-thin ph-envelope-simple', href: '#' },
          ].map((s, i) => (
            <a key={i} href={s.href} className="cc-social-icon" target="_blank" rel="noreferrer">
              <i className={s.icon} />
            </a>
          ))}
        </div>
      </section>

      {/* ══════ §7 COMPASS NAV ════════════════════════════════════════════ */}
      <CompassNav />

      {/* Bottom padding */}
      <div style={{ height: 80 }} />
    </div>
  );
}