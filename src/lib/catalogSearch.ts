import { CATALOG } from '@/lib/catalog';
import { localizedItemName } from '@/lib/departmentText';
import { CATEGORY_TEXT } from '@/lib/i18n';
import type { LanguageCode } from '@/types';

export interface CatalogSearchHit {
  key: string;
  item: string;
  label: string;
  categoryName: string;
  groupLabel: string;
}

const MAX_HITS = 60;

export function searchCatalog(query: string, language: LanguageCode): CatalogSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const hits: CatalogSearchHit[] = [];
  for (const category of CATALOG) {
    const categoryName = CATEGORY_TEXT[category.id]?.[language]?.name ?? CATEGORY_TEXT[category.id]?.en.name ?? category.id;
    for (const group of category.groups) {
      for (const item of group.items) {
        const label = localizedItemName(item, language);
        const haystack = `${item} ${label} ${group.label} ${categoryName}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
        hits.push({ key: `${category.id}-${group.label}-${item}`, item, label, categoryName, groupLabel: group.label });
        if (hits.length >= MAX_HITS) return hits;
      }
    }
  }
  return hits;
}
