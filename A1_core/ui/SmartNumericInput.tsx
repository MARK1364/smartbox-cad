import React, { useState, useEffect, useRef } from 'react';
import { evaluateMathExpression } from '../cad-math/math-eval.js';

export interface SmartNumericInputProps {
    value: number | string;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number | string;
    decimals?: number;
    style?: React.CSSProperties;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    debounceMs?: number;
    unit?: string;
    id?: string;
}

/**
 * SmartNumericInput — Globalny komponent numeryczny dla całego CAD 3D
 * 
 * Cechy:
 * 1. Płynny stan lokalny (zero zacięć klawiatury przy pisaniu)
 * 2. Inteligentny debouncing (domyślnie 120ms) przed wywołaniem ciężkiego przeliczania 3D
 * 3. Obsługa wyrażeń matematycznych (+, -, *, /, nawiasy, przecinek/kropka)
 * 4. Natychmiastowe zatwierdzenie wyniku operacji klawiszem Enter lub przy opuszczeniu pola (onBlur)
 * 5. Pomiary i ochrona przed niekompletnymi wartościami cząstkowymi
 * 6. Obsługa strzałek góra/dół (ArrowUp/ArrowDown) z uwzględnieniem step
 * 7. Precyzja do zadanej liczby miejsc po przecinku (decimals)
 */
export function SmartNumericInput({
    value,
    onChange,
    min,
    max,
    step,
    decimals = 2,
    style,
    className,
    placeholder,
    disabled = false,
    readOnly = false,
    debounceMs = 120,
    unit,
    id
}: SmartNumericInputProps) {
    const effectiveStep = step !== undefined ? step : 1;

    const formatVal = (v: number | string | undefined | null): string => {
        if (v === undefined || v === null || isNaN(Number(v))) return '';
        const num = Number(v);
        if (decimals !== undefined && decimals >= 0) {
            const factor = Math.pow(10, decimals);
            const rounded = Math.round(num * factor) / factor;
            return String(rounded);
        }
        return String(num);
    };

    const [localVal, setLocalVal] = useState<string>(formatVal(value));
    const [isFocused, setIsFocused] = useState(false);
    const debounceTimerRef = useRef<any>(null);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isFocused) {
            setLocalVal(formatVal(value));
        }
    }, [value, isFocused, decimals]);

    const flush = (valStr: string, isFinal: boolean = false) => {
        const parsed = evaluateMathExpression(valStr, decimals);
        if (parsed !== null) {
            let clamped = parsed;
            if (isFinal) {
                if (min !== undefined) clamped = Math.max(min, clamped);
                if (max !== undefined) clamped = Math.min(max, clamped);
                if (decimals !== undefined && decimals >= 0) {
                    const factor = Math.pow(10, decimals);
                    clamped = Math.round(clamped * factor) / factor;
                }
                setLocalVal(formatVal(clamped));
            } else {
                // Podczas pisania nie nadpisujemy pola i nie wysylamy wartosci ponizej min
                if (min !== undefined && parsed < min) return;
                if (max !== undefined && parsed > max) return;
            }
            const currentNum = Number(value);
            if (isNaN(currentNum) || Math.abs(clamped - currentNum) > 1e-6) {
                onChange(clamped);
            }
        } else if (isFinal) {
            setLocalVal(formatVal(value));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalVal(val);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        if (debounceMs <= 0) {
            flush(val, false);
        } else {
            debounceTimerRef.current = setTimeout(() => {
                flush(val, false);
            }, debounceMs);
        }
    };

    const handleBlur = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        setIsFocused(false);
        flush(localVal, true);
    };

    const stepBy = (direction: 1 | -1) => {
        if (disabled || readOnly) return;
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        const stepNum = typeof effectiveStep === 'number' ? effectiveStep : (parseFloat(String(effectiveStep)) || 1);
        const parsed = evaluateMathExpression(localVal, decimals) ?? (typeof value === 'number' ? value : 0);
        let nextVal = parsed + direction * stepNum;
        if (min !== undefined) nextVal = Math.max(min, nextVal);
        if (max !== undefined) nextVal = Math.min(max, nextVal);
        if (decimals !== undefined && decimals >= 0) {
            const factor = Math.pow(10, decimals);
            nextVal = Math.round(nextVal * factor) / factor;
        }
        setLocalVal(formatVal(nextVal));
        onChange(nextVal);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            flush(localVal, true);
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            setLocalVal(formatVal(value));
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            stepBy(e.key === 'ArrowUp' ? 1 : -1);
        }
    };

    const wrapperStyle: React.CSSProperties = {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: style?.width ?? (style?.flex !== undefined ? undefined : '80px'),
        flex: style?.flex,
        minWidth: 0,
        boxSizing: 'border-box',
    };

    const inputStyle: React.CSSProperties = {
        ...style,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        paddingRight: disabled || readOnly ? '6px' : '18px',
        ...(disabled ? {
            background: 'rgba(15, 23, 42, 0.75)',
            color: '#64748b',
            borderColor: 'rgba(148, 163, 184, 0.25)',
            borderStyle: 'dashed',
            cursor: 'not-allowed',
            opacity: 0.55,
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.6)',
        } : {}),
    };

    const stepBtnBaseStyle: React.CSSProperties = {
        flex: 1,
        padding: 0,
        margin: 0,
        border: 'none',
        background: 'rgba(255, 255, 255, 0.08)',
        color: '#cbd5e1',
        fontSize: '7px',
        lineHeight: 1,
        cursor: disabled || readOnly ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const inputElement = (
        <span style={wrapperStyle}>
            <input
                id={id}
                type="text"
                inputMode="decimal"
                value={localVal}
                disabled={disabled}
                readOnly={readOnly}
                placeholder={placeholder}
                title={min !== undefined || max !== undefined ? `Zakres: ${min ?? ''} - ${max ?? ''}${unit ? ` ${unit}` : ' mm'}` : undefined}
                className={className}
                style={inputStyle}
                onFocus={() => setIsFocused(true)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onChange={handleChange}
            />
            {!disabled && !readOnly && (
                <span
                    style={{
                        position: 'absolute',
                        right: '2px',
                        top: '2px',
                        bottom: '2px',
                        width: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '2px',
                        overflow: 'hidden',
                    }}
                >
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label="+"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            stepBy(1);
                        }}
                        style={stepBtnBaseStyle}
                    >
                        ▲
                    </button>
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label="-"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            stepBy(-1);
                        }}
                        style={{
                            ...stepBtnBaseStyle,
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        ▼
                    </button>
                </span>
            )}
        </span>
    );

    if (unit) {
        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {inputElement}
                <span className="unit" style={{ fontSize: '11px', color: '#a1a1aa' }}>{unit}</span>
            </div>
        );
    }

    return inputElement;
}
