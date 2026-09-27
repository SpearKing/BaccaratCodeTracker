// src/engine/venues.js
//
// The list of places you have played, derived from what you have saved.
//
// Venue used to be a free-text box beside the save name, which meant it was
// typed twice -- once into the name, once into the field -- and the two drifted
// immediately. Two days in there were six spellings for four casinos:
// "Boomtown MS" and "Boomtown", "L'auberge" and "l'auberge".
//
// It cannot be read back off the name either. Names carry three things at once
// -- venue, a qualifier and a sequence number -- so "L'auberge1", "L'auberge
// Revised", "L'auberge Video" and "L'auberge (Video Baccarat)" are all one
// casino, and nothing can tell from the text that the Video one is a machine
// and the Revised one is a table. That distinction is the most important split
// in the data, so it has to be recorded, not inferred.
//
// So the venue is picked from this list and the NAME is built from it. One
// place to enter it, one canonical spelling, and the list grows by using it.

/** Trimmed, with runs of whitespace collapsed. */
export const normalizeVenue = (name) => String(name || '').trim().replace(/\s+/g, ' ');

/** Two venues are the same place if they differ only by case or spacing. */
export const sameVenue = (a, b) =>
    normalizeVenue(a).toLowerCase() === normalizeVenue(b).toLowerCase();

/**
 * Every venue already used, one entry per place, most-used spelling first.
 *
 * Case variants collapse to whichever spelling appears most often, so picking
 * from this list stops the drift rather than preserving it. Ties go to the
 * spelling that is not all-lowercase, which is almost always the intended one.
 */
export const venuesFrom = (savedCards) => {
    const byKey = new Map();

    Object.values(savedCards || {}).forEach((data) => {
        const venue = normalizeVenue(data && data.venue);
        if (!venue) return;

        const key = venue.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, new Map());
        const spellings = byKey.get(key);
        spellings.set(venue, (spellings.get(venue) || 0) + 1);
    });

    return [...byKey.values()]
        .map((spellings) => {
            const ranked = [...spellings.entries()].sort((a, b) =>
                b[1] - a[1] ||
                (a[0] === a[0].toLowerCase() ? 1 : 0) - (b[0] === b[0].toLowerCase() ? 1 : 0) ||
                a[0].localeCompare(b[0])
            );
            return { venue: ranked[0][0], uses: [...spellings.values()].reduce((a, b) => a + b, 0) };
        })
        .sort((a, b) => b.uses - a.uses || a.venue.localeCompare(b.venue));
};

/**
 * The canonical spelling for what was typed, if it is a place already known.
 *
 * Typing "boomtown ms" when "Boomtown MS" is on the list stores the spelling
 * already in use, so the two never become separate venues in the reports.
 */
export const canonicalVenue = (typed, known) => {
    const cleaned = normalizeVenue(typed);
    if (!cleaned) return '';
    const match = (known || []).find((k) => sameVenue(k.venue ?? k, cleaned));
    return match ? (match.venue ?? match) : cleaned;
};

/**
 * The save name for a sitting: the venue, an optional label, then the date.
 *
 * The label is where a qualifier goes -- "Video", "Revised", "2" -- so it stays
 * out of the venue itself. Deliberately NOT title-cased: that turned
 * "Boomtown MS" into "Boomtown Ms", which is how the venue and the name came to
 * disagree in the first place.
 */
export const saveNameFor = (venue, label, formattedDate) => {
    const base = [normalizeVenue(venue), normalizeVenue(label)].filter(Boolean).join(' ');
    return formattedDate ? `${base} - ${formattedDate}` : base;
};
