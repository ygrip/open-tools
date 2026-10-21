import en from '../../../messages/en.json';
import id from '../../../messages/id.json';

export type LegalKind = 'terms' | 'policy';
export type LegalLocale = 'en' | 'id';

export function legalCopy(kind: LegalKind, locale: LegalLocale) {
  const t = locale === 'id' ? id : en;
  const isTerms = kind === 'terms';
  return {
    kind,
    title: isTerms ? t.terms_title : t.policy_title,
    description: isTerms ? t.terms_description : t.policy_description,
    eyebrow: isTerms ? t.legal_label : t.policy_eyebrow,
    intro: isTerms ? t.terms_intro : t.policy_intro,
    updated: t.legal_last_updated,
    shortTitle: t.legal_in_short,
    summary: isTerms ? t.terms_summary : t.policy_summary,
    illustrationAlt: isTerms ? t.terms_illustration_alt : t.policy_illustration_alt,
    sections: isTerms
      ? [
          { title: t.terms_use_title, text: t.terms_use_text },
          { title: t.terms_files_title, text: t.terms_files_text },
          { title: t.terms_availability_title, text: t.terms_availability_text },
          { title: t.terms_liability_title, text: t.terms_liability_text },
          { title: t.terms_third_title, text: t.terms_third_text }
        ]
      : [
          { title: t.policy_register_title, text: t.policy_register_text },
          { title: t.policy_route_title, text: t.policy_route_text },
          { title: t.policy_behavior_title, text: t.policy_behavior_text },
          { title: t.policy_limits_title, text: t.policy_limits_text },
          { title: t.policy_remove_title, text: t.policy_remove_text }
        ],
    relatedAria: t.legal_related_label,
    relatedTitle: t.legal_related_title,
    related: [
      { path: '/privacy/', label: t.footer_privacy },
      { path: isTerms ? '/policy/' : '/terms/', label: isTerms ? t.footer_policy : t.footer_terms }
    ]
  };
}
