// src/engine/version.js
//
// Lives alone so both the predictor and the arbitrator can name the current
// engine without importing each other.

/**
 * Identifies the rules AND how conflicts between them are settled.
 *
 * Bump this whenever either could change an output. Decisions logged under a
 * different version are scored apart from these and never blended with them --
 * a mixed accuracy figure can never be separated again afterwards.
 *
 *   rule-of-three+pattern@1  hard-coded precedence, Rule of Three always won
 *   arbitrated@2             one rule list, conflicts go to the better record
 */
export const ENGINE_VERSION = 'arbitrated@2';
