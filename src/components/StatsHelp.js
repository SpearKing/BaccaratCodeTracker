// src/components/StatsHelp.js
//
// Plain-language explanation of the stats panel.
//
// Written for someone reading it at a table, not for someone who wants the
// statistics lecture. Every number on that screen exists to answer "is this
// working", and the honest answer is usually "not yet, and here is how much
// more you would need to know" -- so the help says that rather than dressing
// it up.

import React from 'react';
import { MIN_CALIBRATION_SAMPLE } from '../engine/stats';
import { MIN_FIRINGS } from '../engine/arbitrate';

const Term = ({ name, children }) => (
    <p className="help-term"><strong>{name}</strong> — {children}</p>
);

const StatsHelp = () => (
    <div className="stats-help">
        <p className="help-intro">
            Everything here answers one question: is the engine doing better than guessing?
            Numbers are shown with the uncertainty attached, because a hit rate on its own
            can look convincing when it means nothing.
        </p>

        <h3>Terms used throughout</h3>
        <Term name="n">
            How many hands a number is based on. Small n means the number could easily be luck.
        </Term>
        <Term name="The range in brackets">
            The honest span the true rate could sit in. “52% (46% – 58%)” means the real rate
            is probably somewhere in that span — and since it includes 50%, the result is not
            yet distinguishable from a coin flip. Narrowing it takes more hands: four times as
            many to halve it.
        </Term>
        <Term name="Break-even">
            The hit rate you must beat just to stop losing. It is not 50%. Banker pays 0.95 to
            1 after commission, so a Banker bet needs <strong>51.28%</strong>; Player pays even
            money and needs 50%. A blended figure is shown when both sides were called.
        </Term>
        <Term name="Per unit staked">
            Money, not accuracy. +0.02 means two pence back for every pound risked, on average.
            This can be negative while the hit rate is above 50%, which is exactly why it is here.
        </Term>

        <h3>The prediction bar</h3>
        <p>Reads <strong>Prediction: B&nbsp;&nbsp; Rule: Wiener-3&nbsp;&nbsp; C: 51%</strong>.</p>
        <Term name="Prediction">The side to back on the next hand.</Term>
        <Term name="Rule">
            Which rule produced that call. Several can fire on the same hand and disagree; this
            is the one that won, and “When rules disagree” in the stats shows how those are settled.
        </Term>
        <Term name="C">
            How often calls made at this confidence have actually come in. It describes the
            confidence level, <em>not</em> the rule named beside it — the two are separate
            measurements that happen to sit together. It turns red only when the whole range
            sits below break-even, so a middling figure staying black means the sample is not
            yet conclusive either way.
        </Term>
        <p>C reads “—” until <strong>{MIN_CALIBRATION_SAMPLE} hands</strong> have been played at
            that confidence. A rate over fewer than that is not a rate.</p>

        <h3>This card</h3>
        <p>How many hands Banker and Player have each won on the card you are on. Nothing more
            than a count — a shoe running 60/40 either way is unremarkable.</p>

        <h3>Predictions (all cards)</h3>
        <p>The engine’s record across every card, not just this one.</p>
        <Term name="Hit rate">How often the call was right, with its range.</Term>
        <Term name="Verdict">
            The plain answer. “Clears break-even” only appears when the <em>whole</em> range sits
            above the bar — an estimate above it with a range straddling it is not evidence.
        </Term>
        <Term name="Record">
            Wins, losses, and pushes. A tie returns your stake, so it counts as neither.
        </Term>
        <Term name="Offered an opinion">
            How often the engine had a call at all. An engine that never declines is not
            choosing its spots.
        </Term>

        <h3>Compared with betting blind</h3>
        <p>The same hands, scored as if you had ignored the engine entirely and just bet Banker
            every time, or Player every time, or always repeated the last result, or always
            switched. If the engine cannot beat these, it is not adding anything — and this is
            the comparison that makes a hit rate readable.</p>

        <h3>By rule</h3>
        <p>Each rule’s own record, shown for this card and overall. It counts every hand a rule
            fired on, whether or not its call was the one used — a rule that keeps losing the
            argument still needs a record, or it could never earn its way back.</p>
        <p>A rule needs <strong>{MIN_FIRINGS} firings</strong> before its rate is trusted. Below
            that the rate is greyed and ignored, because a rate over a handful of hands is not
            a rate.</p>

        <h3>When rules disagree</h3>
        <p>Two rules can both fire and call opposite sides. This table shows who has actually
            been right when that happens, and it is what settles the conflict.</p>
        <p>It is a different question from the table above. A rule can be good in general and
            poor against one particular opponent, because a clash only happens on the specific
            kind of board where both rules apply — and that is the board that matters when
            deciding between them.</p>

        <h3>By pattern</h3>
        <p>Which of the grid patterns drove the call, and how those calls fared. Credited only
            to the pattern that actually decided it, not to every pattern lit at the time.</p>

        <h3>Log</h3>
        <p>How many decisions have been recorded, and how many are still waiting to reach the
            server. Waiting is normal and safe — they are kept on this device and sent when the
            connection allows.</p>
        <Term name="Engine">
            Which version of the rules produced these numbers. Change the rules and the old
            record is set aside rather than blended in, because a mixed figure can never be
            unpicked afterwards.
        </Term>
        <Term name="Test hands">
            Hands played in test mode. They are kept but excluded from everything above, and
            from what the engine learns.
        </Term>

        <h3>What to watch for</h3>
        <p>One number matters more than the hit rate: whether the <em>range</em> has pulled clear
            of break-even. Until it has, a good-looking percentage is just a small sample. Telling
            a genuine two-point edge from noise takes on the order of 3,900 predictions.</p>
    </div>
);

export default StatsHelp;
