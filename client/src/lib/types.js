export const TYPES = {
  webinar: {
    title: 'Webinar Copywriter',
    description: 'Registration pages, Promo & Replay emails, the pitch, offer stack',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 9 5 3-5 3V9z"/></svg>`,
    color: '#7C3AED',
    colorBg: '#EDE9FE',
  },
  email: {
    title: 'Email Copywriter',
    description: 'Single emails & full sequences — nurture, launch, cart-close, daily',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    color: '#2563EB',
    colorBg: '#EFF6FF',
  },
  social: {
    title: 'Social Copywriter',
    description: 'Long-form LinkedIn/X posts, threads, carousel & caption copy',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
    color: '#0EA5E9',
    colorBg: '#E0F2FE',
  },
  ads: {
    title: 'Ads Copywriter',
    description: 'FB/IG, Google Search, YouTube pre-roll — multiple angles, limits enforced',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`,
    color: '#DC2626',
    colorBg: '#FEE2E2',
  },
  'sales-page': {
    title: 'Sales & Page Copywriter',
    description: 'Sales letters, long-form sales pages, opt-ins, and upsell pages',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    color: '#D97706',
    colorBg: '#FEF3C7',
  },
  blog: {
    title: 'Blog Copywriter',
    description: 'Articles & posts that teach, rank, and quietly convert',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    color: '#059669',
    colorBg: '#D1FAE5',
  },
  general: {
    title: 'General Copywriter',
    description: 'Anything else — SMS, scripts, bio, taglines, product copy, mixed asks',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    color: '#6366F1',
    colorBg: '#EEF2FF',
  },
}

export const TYPE_ORDER = ['email', 'social', 'ads', 'sales-page', 'webinar', 'blog', 'general']
