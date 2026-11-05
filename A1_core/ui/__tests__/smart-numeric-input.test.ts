import { describe, it, expect } from 'vitest';
import { evaluateMathExpression } from '../../cad-math/math-eval.js';

describe('SmartNumericInput Math Evaluation Logic', () => {
    it('evaluates operations like 5+2 to 7', () => {
        const inputStr = '5+2';
        const parsed = evaluateMathExpression(inputStr, 2);
        expect(parsed).toBe(7);

        // Symulacja formatowania wyniku do wyświetlenia w polu (np. 5+2 -> 7)
        const displayVal = String(parsed);
        expect(displayVal).toBe('7');
    });

    it('evaluates complex operations with decimal comma, parentheses and divisions', () => {
        expect(evaluateMathExpression('720 / 2 - 18,5', 2)).toBe(341.5);
        expect(evaluateMathExpression('(600 - 100) * 1.5', 2)).toBe(750);
        expect(evaluateMathExpression('100 + 25 * 2', 2)).toBe(150);
    });

    it('clamps evaluated values to min and max', () => {
        const min = 10;
        const max = 100;

        const val1 = evaluateMathExpression('80 + 50', 2)!;
        const clamped1 = Math.min(max, Math.max(min, val1));
        expect(clamped1).toBe(100);

        const val2 = evaluateMathExpression('5 - 20', 2)!;
        const clamped2 = Math.min(max, Math.max(min, val2));
        expect(clamped2).toBe(10);
    });

    it('handles rounding based on decimals prop', () => {
        expect(evaluateMathExpression('10 / 3', 0)).toBe(3);
        expect(evaluateMathExpression('10 / 3', 2)).toBe(3.33);
        expect(evaluateMathExpression('10 / 3', 3)).toBe(3.333);
    });

    it('rejects invalid or incomplete intermediate expressions safely without crashing', () => {
        expect(evaluateMathExpression('5+')).toBeNull();
        expect(evaluateMathExpression('10 *')).toBeNull();
        expect(evaluateMathExpression('(')).toBeNull();
        expect(evaluateMathExpression('abc')).toBeNull();
    });
});

