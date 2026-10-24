/**
 * Watermark G-code — wstrzykuje znacznik do nagłówka pliku maszynowego w sposób
 * zgodny z formatem danego postprocesora (bez psucia struktury pliku).
 *
 * Cel: śledzenie wycieków (ID licencji) oraz ostrzeżenie w wersji próbnej.
 */

function sanitize(mark: string): string {
  return mark.replace(/[\r\n\t]+/g, ' ').replace(/[()]/g, '').trim();
}

function injectWoodwopHeader(code: string, mark: string): string {
  const line = `WATERMARK=${sanitize(mark)}`;
  if (code.includes('[HEADER]')) {
    return code.replace('[HEADER]', `[HEADER]\n${line}`);
  }
  return `[HEADER]\n${line}\n${code}`;
}

function injectBiesseHeader(code: string, mark: string): string {
  const line = `  WATERMARK=${sanitize(mark)}`;
  if (code.includes('END HEADER')) {
    return code.replace('END HEADER', `${line}\nEND HEADER`);
  }
  return `${line}\n${code}`;
}

/**
 * @param code          kod wygenerowany przez postprocesor
 * @param postprocessor nazwa postprocesora (Mach3, Fanuc, WoodWOP, Biesse, SCM)
 * @param mark          treść watermarku (np. "Licencja ... [LIC-...]")
 */
export function watermarkGCode(code: string, postprocessor: string, mark: string): string {
  if (!mark) return code;
  const p = (postprocessor || 'Mach3').toLowerCase();
  const stamp = `Crevo CAM | ${sanitize(mark)}`;

  if (p === 'woodwop') return injectWoodwopHeader(code, mark);
  if (p === 'biesse') return injectBiesseHeader(code, mark);
  if (p === 'scm') return `; ${stamp}\n${code}`;

  // Mach3 / Fanuc / domyślnie — komentarz w nawiasach (standard ISO).
  return `(${stamp})\n${code}`;
}
