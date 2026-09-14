import React, { useState, useEffect, useRef } from 'react';

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
}

/**
 * SmartNumericInput — Globalny komponent numeryczny dla całego CAD 3D
 * 
 * Cechy:
 * 1. Płynny stan lokalny (zero zacięć klawiatury przy pisaniu)
 * 2. Inteligentny debouncing (domyślnie 120ms) przed wywołaniem ciężkiego przeliczania 3D
 * 3. Natychmiastowe zatwierdzenie wartości klawiszem Enter lub przy opuszczeniu pola (onBlur)
 * 4. Pomiary i ochrona przed niekompletnymi wartościami cząstkowymi
 * 5. Precyzja do 2 miejsc po przecinku (decimals) oraz obsługa przecinka dziesiętnego
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
    unit
}: SmartNumericInputProps) {
    const effectiveStep = step !== undefined ? step : (decimals !== undefined && decimals === 0 ? 1 : 0.01);

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
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (!isFocused) {
            setLocalVal(formatVal(value));
        }
    }, [value, isFocused, decimals]);

    const parseNum = (str: string): number => {
        const sanitized = str.replace(',', '.');
        return parseFloat(sanitized);
    };

    const flush = (valStr: string) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const parsed = parseNum(valStr);
        if (!isNaN(parsed)) {
            let clamped = parsed;
            if (min !== undefined) clamped = Math.max(min, clamped);
            if (max !== undefined) clamped = Math.min(max, clamped);
            if (decimals !== undefined && decimals >= 0) {
                const factor = Math.pow(10, decimals);
                clamped = Math.round(clamped * factor) / factor;
            }
            onChange(clamped);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalVal(raw);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        const parsed = parseNum(raw);
        // Filtrujemy niekompletne wartości w trakcie pisania
        if (!isNaN(parsed) && (min === undefined || min <= 0 || parsed >= min)) {
            timerRef.current = setTimeout(() => {
                let clamped = parsed;
                if (min !== undefined) clamped = Math.max(min, clamped);
                if (max !== undefined) clamped = Math.min(max, clamped);
                if (decimals !== undefined && decimals >= 0) {
                    const factor = Math.pow(10, decimals);
                    clamped = Math.round(clamped * factor) / factor;
                }
                onChange(clamped);
            }, debounceMs);
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        flush(localVal);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            flush(localVal);
            (e.target as HTMLInputElement).blur();
        }
    };

    const inputElement = (
        <input
            type="number"
            value={localVal}
            step={effectiveStep}
            min={min}
            max={max}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            className={className}
            style={style}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
        />
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
