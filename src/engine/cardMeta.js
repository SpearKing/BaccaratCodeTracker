// src/engine/cardMeta.js
//
// What kind of game a card was recorded at.
//
// This exists because table type was previously encoded in card NAMES by
// convention, and that convention quietly failed. "L'auberge Video" and
// "L'auberge Revised" sort into the same venue by any sensible reading of the
// name, but one is a video machine and the other is a physical table -- which
// are different experiments. Grouping them together put 40 machine bets into
// what was reported as physical-table evidence.
//
// The distinction matters more than any other split in the data. A video
// machine reshuffles continuously or draws from an RNG: no residual shuffle
// order, no cut card, no penetration, no dealer changes and so no burns. Every
// physical explanation for a pattern is absent there by construction. So
// machine play is not a weaker version of table play -- it is the control arm,
// and mixing the two destroys both.
//
// Nothing is ever inferred from a name. An unclassified card reads `unknown`
// and is reported as unknown, because a wrong guess here is worse than a gap:
// a gap is visible and a guess is not.

export const TABLE_TYPES = [
    { id: 'table', label: 'Physical table', note: 'Real cards, dealt by a dealer' },
    { id: 'machine', label: 'Machine / video', note: 'RNG or continuous shuffler' },
    { id: 'unknown', label: 'Not recorded', note: 'Unclassified' },
];

export const SHUFFLES = [
    { id: 'unknown', label: 'Not recorded' },
    { id: 'hand', label: 'Hand shuffled' },
    { id: 'auto', label: 'Automatic shuffler' },
    { id: 'continuous', label: 'Continuous shuffler' },
    { id: 'rng', label: 'RNG / video' },
];

export const UNKNOWN = 'unknown';

export const EMPTY_META = { venue: '', tableType: UNKNOWN, shuffle: UNKNOWN };

const validId = (list, value) =>
    list.some((x) => x.id === value) ? value : UNKNOWN;

/** The metadata on a stored card, with anything missing or unrecognised as unknown. */
export const metaFrom = (data) => {
    if (!data || typeof data !== 'object') return { ...EMPTY_META };
    return {
        venue: typeof data.venue === 'string' ? data.venue : '',
        tableType: validId(TABLE_TYPES, data.tableType),
        shuffle: validId(SHUFFLES, data.shuffle),
    };
};

/** The part of a save payload that carries metadata. Passed to `toStored`. */
export const metaPayload = (meta) => {
    const m = metaFrom(meta);
    return { venue: m.venue, tableType: m.tableType, shuffle: m.shuffle };
};

/** Card name -> metadata, over every saved card. */
export const metaIndex = (allSavedScorecards) => {
    const index = new Map();
    Object.entries(allSavedScorecards || {}).forEach(([name, data]) => {
        index.set(name, metaFrom(data));
    });
    return index;
};

/** The table type a decision was recorded at, or unknown if its card is not classified. */
export const typeOfEntry = (entry, index) =>
    index?.get(entry?.card)?.tableType || UNKNOWN;

/**
 * Splits decisions into the arms that can legitimately be compared.
 *
 * Returns a Map keyed by table type, so a caller can score each separately
 * rather than pooling a control arm into a treatment arm.
 */
export const splitByTableType = (entries, index) => {
    const out = new Map(TABLE_TYPES.map((t) => [t.id, []]));
    (entries || []).forEach((entry) => {
        const type = typeOfEntry(entry, index);
        if (!out.has(type)) out.set(type, []);
        out.get(type).push(entry);
    });
    return out;
};

/** How many saved cards are still unclassified -- what the panel nags about. */
export const unclassifiedCards = (allSavedScorecards) =>
    Object.entries(allSavedScorecards || {})
        .filter(([, data]) => metaFrom(data).tableType === UNKNOWN)
        .map(([name]) => name);

export const tableTypeLabel = (id) =>
    TABLE_TYPES.find((t) => t.id === id)?.label || 'Not recorded';
