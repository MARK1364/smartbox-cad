const BLOKI_INPUT_FUNCTION = /\bexport\s+function\s+(normalize\w*Params|build\w*Plan)\s*\(\s*(?:raw|params)\s*:\s*([^,)=\n]+)/g;
const ANY_CALLBACK = /(?:triggerUpdate\s*:\s*\(\s*params|triggerUpdate\w*\s*=\s*useCallback\(\(\s*updatedParams)\s*:\s*any\b/g;

export function findBlokiInputTypeViolations(relativePath, source) {
    const violations = [];
    for (const match of source.matchAll(BLOKI_INPUT_FUNCTION)) {
        const [, name, inputType] = match;
        if (!/\b\w+PlanParams\b/.test(inputType.trim())) {
            violations.push(`${relativePath}: ${name} input is '${inputType.trim()}'`);
        }
    }

    if (relativePath.endsWith('-adapter.tsx') || relativePath === 'A2_bloki/bloki-ui.tsx' || relativePath === 'A2_bloki/bloki-ui.tsx') {
        for (const match of source.matchAll(ANY_CALLBACK)) {
            const line = source.slice(0, match.index).split(/\r?\n/).length;
            violations.push(`${relativePath}:${line}: callback payload is any`);
        }
    }

    return violations;
}
