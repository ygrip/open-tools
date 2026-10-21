import en from '../../../messages/en.json';
import id from '../../../messages/id.json';

export type LegalKind = 'terms' | 'policy' | 'privacy';
export type LegalLocale = 'en' | 'id';

export function legalCopy(kind: LegalKind, locale: LegalLocale) {
  const t = locale === 'id' ? id : en;
  const titles = { terms: t.terms_title, policy: t.policy_title, privacy: t.privacy_title };
  const descriptions = { terms: t.terms_description, policy: t.policy_description, privacy: t.privacy_description };
  const eyebrows = { terms: t.legal_label, policy: t.policy_eyebrow, privacy: t.privacy_eyebrow };
  const intros = { terms: t.terms_intro, policy: t.policy_intro, privacy: t.privacy_intro };
  const summaries = { terms: t.terms_summary, policy: t.policy_summary, privacy: t.privacy_summary };
  const illustrations = { terms: t.terms_illustration_alt, policy: t.policy_illustration_alt, privacy: t.privacy_illustration_alt };
  const sections = {
    terms: [
      { title: t.terms_use_title, text: t.terms_use_text },
      { title: t.terms_files_title, text: t.terms_files_text },
      { title: t.terms_availability_title, text: t.terms_availability_text },
      { title: t.terms_liability_title, text: t.terms_liability_text },
      { title: t.terms_third_title, text: t.terms_third_text }
    ],
    policy: [
      { title: t.policy_register_title, text: t.policy_register_text },
      { title: t.policy_route_title, text: t.policy_route_text },
      { title: t.policy_behavior_title, text: t.policy_behavior_text },
      { title: t.policy_limits_title, text: t.policy_limits_text },
      { title: t.policy_remove_title, text: t.policy_remove_text }
    ],
    privacy: [
      { title: t.privacy_local_title, text: t.privacy_local_text },
      { title: t.privacy_service_title, text: t.privacy_service_text },
      { title: t.privacy_online_title, text: t.privacy_online_text },
      { title: t.privacy_protection_title, text: t.privacy_protection_text },
      { title: t.privacy_storage_title, text: t.privacy_storage_text },
      { title: t.privacy_analytics_title, text: t.privacy_analytics_text },
      { title: t.privacy_links_title, text: t.privacy_links_text }
    ]
  };
  const links = {
    terms: [{ path: '/privacy/', label: t.footer_privacy }, { path: '/policy/', label: t.footer_policy }],
    policy: [{ path: '/privacy/', label: t.footer_privacy }, { path: '/terms/', label: t.footer_terms }],
    privacy: [{ path: '/terms/', label: t.footer_terms }, { path: '/policy/', label: t.footer_policy }]
  };
  return {
    kind, title: titles[kind], description: descriptions[kind], eyebrow: eyebrows[kind],
    intro: intros[kind], updated: t.legal_last_updated, shortTitle: t.legal_in_short,
    summary: summaries[kind], illustrationAlt: illustrations[kind], sections: sections[kind],
    relatedAria: t.legal_related_label, relatedTitle: t.legal_related_title, related: links[kind]
  };
}
