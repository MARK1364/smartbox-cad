/**
 * Zapytania do ProjectDocument używane przez composition root (cad-app).
 */

export function getAllContainers(doc: any): any[] {
  if (!doc) return [];
  const document = doc.document || doc;
  const items = typeof document.getContainers === 'function' ? document.getContainers() : [];
  return items.map((item: any) => item.domainData || item).filter(Boolean);
}

export function getAllPanels(doc: any): any[] {
  if (!doc) return [];
  const document = doc.document || doc;
  const items = typeof document.getPanels === 'function' ? document.getPanels() : [];
  return items.map((item: any) => item.domainData || item).filter(Boolean);
}
