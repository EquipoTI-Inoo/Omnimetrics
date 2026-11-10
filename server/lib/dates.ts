// Date helpers on plain YYYY-MM-DD strings (UTC-based so no DST surprises)

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) => {
    const d = toDate(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return toIso(d);
};

export const daysBetween = (start: string, end: string) => Math.round((toDate(end).getTime() - toDate(start).getTime()) / 86400000) + 1;

export const eachDay = (start: string, end: string): string[] => {
    const out: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
};

/** Splits [start, end] into consecutive windows of at most `size` days (some APIs cap daily reports). */
export const chunks = (start: string, end: string, size: number) => {
    const out: { start: string; end: string }[] = [];
    for (let s = start; s <= end; s = addDays(s, size)) {
        const e = addDays(s, size - 1);
        out.push({ start: s, end: e < end ? e : end });
    }
    return out;
};

/** Ranges up to 45 days are shown per day, longer ones per week (weeks start on Monday). */
export const granularity = (start: string, end: string): 'day' | 'week' => daysBetween(start, end) <= 45 ? 'day' : 'week';

export const bucketOf = (iso: string, g: 'day' | 'week') => {
    if (g === 'day') return iso;
    const dow = (toDate(iso).getUTCDay() + 6) % 7; // 0 = Monday
    return addDays(iso, -dow);
};

export const bucketsFor = (start: string, end: string) => {
    const g = granularity(start, end);
    return [...new Set(eachDay(start, end).map(d => bucketOf(d, g)))];
};

/** "2026-10-05" -> "05/10" */
export const shortLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
