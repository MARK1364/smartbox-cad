import React, { useState, useEffect, useRef } from 'react';

export interface SmartNumericInputProps {
    value: number | string;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number;
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
 */
export function SmartNumericInput({
    value,
    onChange,
    min,
    max,
    step = 1,
    style,
    className,
    placeholder,
    disabled = false,
    readOnly = false,
    debounceMs = 120,
    unit
}: SmartNumericInputProps) {
    const [localVal, setLocalVal] = useState<string>(value !== undefined && value !== null ? String(value) : '');
    const [isFocused, setIsFocused] = useState(false);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (!isFocused) {
            setLocalVal(value !== undefined && value !== null && !isNaN(Number(value)) ? String(value) : '');
        }
    }, [value, isFocused]);

    const flush = (valStr: string) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const parsed = parseFloat(valStr);
        if (!isNaN(parsed)) {
            let clamped = parsed;
            if (min !== undefined) clamped = Math.max(min, clamped);
            if (max !== undefined) clamped = Math.min(max, clamped);
            onChange(clamped);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalVal(raw);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        const parsed = parseFloat(raw);
        // Filtrujemy niekompletne wartości w trakcie pisania
        if (!isNaN(parsed) && (min === undefined || min <= 0 || parsed >= min)) {
            timerRef.current = setTimeout(() => {
                let clamped = parsed;
                if (min !== undefined) clamped = Math.max(min, clamped);
                if (max !== undefined) clamped = Math.min(max, clamped);
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
            step={step}
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
