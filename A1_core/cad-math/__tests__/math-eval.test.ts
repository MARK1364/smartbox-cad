import { describe, it, expect } from 'vitest';
import { evaluateMathExpression } from '../math-eval.js';

describe('evaluateMathExpression', () => {
    it('evaluates basic operations: addition, subtraction, multiplication, division', () => {
        expect(evaluateMathExpression('5+2')).toBe(7);
        expect(evaluateMathExpression('5 + 2')).toBe(7);
        expect(evaluateMathExpression('10 - 3')).toBe(7);
        expect(evaluateMathExpression('6 * 7')).toBe(42);
        expect(evaluateMathExpression('720 / 2')).toBe(360);
    });

    it('evaluates complex expressions with operator precedence and parentheses', () => {
        expect(evaluateMathExpression('(600 - 100) * 1.5')).toBe(750);
        expect(evaluateMathExpression('100 + 20 * 2')).toBe(140);
        expect(evaluateMathExpression('(100 + 20) * 2')).toBe(240);
        expect(evaluateMathExpression('720 / 2 - 18')).toBe(342);
    });

    it('handles commas as decimal separators', () => {
        expect(evaluateMathExpression('5,5 + 2')).toBe(7.5);
        expect(evaluateMathExpression('88,5')).toBe(88.5);
        expect(evaluateMathExpression('18,2 + 1,8')).toBe(20);
    });

    it('handles negative numbers', () => {
        expect(evaluateMathExpression('-25')).toBe(-25);
        expect(evaluateMathExpression('-5 + 10')).toBe(5);
        expect(evaluateMathExpression('100 + -20')).toBe(80);
    });

    it('rounds to specified decimals', () => {
        expect(evaluateMathExpression('10 / 3', 2)).toBe(3.33);
        expect(evaluateMathExpression('10 / 3', 0)).toBe(3);
        expect(evaluateMathExpression('10 / 3', 4)).toBe(3.3333);
    });

    it('handles number inputs directly', () => {
        expect(evaluateMathExpression(42)).toBe(42);
        expect(evaluateMathExpression(42.555, 2)).toBe(42.56);
    });

    it('safely rejects invalid strings and code injection attempts', () => {
        expect(evaluateMathExpression('abc')).toBeNull();
        expect(evaluateMathExpression('window.alert()')).toBeNull();
        expect(evaluateMathExpression('5 + ')).toBeNull();
        expect(evaluateMathExpression('')).toBeNull();
        expect(evaluateMathExpression(null)).toBeNull();
        expect(evaluateMathExpression(undefined)).toBeNull();
        expect(evaluateMathExpression('console.log(1)')).toBeNull();
        expect(evaluateMathExpression('1 / 0')).toBeNull();
    });
});

