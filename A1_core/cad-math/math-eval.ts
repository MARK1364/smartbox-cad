/**
 * SmartPanel Web — Math Expression Evaluator
 * 
 * Bezpieczny ewaluator wyrażeń arytmetycznych w inputach numerycznych.
 * Zezwala wyłącznie na cyfry, przecinki/kropki, operatory (+, -, *, /) i nawiasy.
 */

export function evaluateMathExpression(expr: string | number | null | undefined, decimals?: number): number | null {
    if (expr === null || expr === undefined) return null;

    if (typeof expr === 'number') {
        if (isNaN(expr) || !isFinite(expr)) return null;
        if (decimals !== undefined && decimals >= 0) {
            const factor = Math.pow(10, decimals);
            return Math.round(expr * factor) / factor;
        }
        return expr;
    }

    const str = String(expr).trim();
    if (!str) return null;

    // Zamiana przecinków dziesiętnych na kropki (np. "5,5" -> "5.5")
    const sanitized = str.replace(/,/g, '.').trim();

    // Ścisła biała lista: dozwolone wyłącznie cyfry, spacje, operatory arytmetyczne, kropki i nawiasy
    if (!/^[0-9\s\+\-\*\/\.\(\)]+$/.test(sanitized)) {
        return null;
    }

    try {
        // Bezpieczne wykonanie wyrażenia numerycznego
        const fn = new Function(`"use strict"; return (${sanitized});`);
        const res = fn();

        if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
            if (decimals !== undefined && decimals >= 0) {
                const factor = Math.pow(10, decimals);
                return Math.round(res * factor) / factor;
            }
            return res;
        }
    } catch {
        return null;
    }

    return null;
}

