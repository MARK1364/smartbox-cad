/**
 * Prosty szyna zdarzeń "poproś o upgrade" — pozwala głęboko zagnieżdżonym
 * komponentom (np. GCodeTab w CncPanel) otworzyć globalny ekran paywall
 * bez przekazywania callbacków przez całe drzewo propsów.
 */

export type UpgradeHandler = (feature?: string) => void;

let handler: UpgradeHandler | null = null;

export const SaaSUpgradeBus = {
  /** Rejestruje handler (App.tsx). Zwraca funkcję odpinającą. */
  setHandler(fn: UpgradeHandler | null): () => void {
    handler = fn;
    return () => {
      if (handler === fn) handler = null;
    };
  },

  /** Prosi o otwarcie paywallu dla danej funkcji. */
  requestUpgrade(feature?: string): void {
    if (handler) {
      handler(feature);
    } else {
      console.warn('[SaaSUpgradeBus] Brak zarejestrowanego handlera. Funkcja:', feature);
    }
  },
};
