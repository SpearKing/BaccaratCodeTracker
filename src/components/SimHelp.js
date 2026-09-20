// src/components/SimHelp.js
//
// Plain-language explanation of the simulator, weighted towards the two charts.
//
// The equity curve is the part that needs explaining most, because read naively
// it is the most misleading picture in the app: a rising line looks like proof
// and is not. A rule set with no edge whatsoever produces rising lines all the
// time, and over a long enough run it produces dramatic ones. Everything below
// is written to make the band -- not the line -- the thing the eye goes to.

import React from 'react';

const Term = ({ name, children }) => (
    <p className="help-term"><strong>{name}</strong> — {children}</p>
);

const SimHelp = () => (
    <div className="stats-help">
        <p className="help-intro">
            The simulator deals fresh baccarat shoes and plays your chosen rules over
            them, thousands or millions of hands at a time. It answers one question:
            would these rules make money against a game with no memory?
        </p>

        <h3>The equity curve</h3>
        <p>The line is your running balance, in units. One unit is bet each time a rule
            fires. The line goes up when you are ahead overall and down when you are behind.
            The left edge is your first bet; the right edge is your last.</p>

        <Term name="The grey band">
            Where a rule set with <em>no edge at all</em> would spend 95% of its time.
            This is the important part of the picture. Anything inside the band is what
            pure luck looks like — including a line that climbs the whole way.
        </Term>

        <Term name="Why the band gets wider">
            Because luck accumulates. Flip a coin ten times and you might be three ahead;
            flip it a million times and you might be a thousand ahead, purely by chance.
            The band spreads to match, so it is not a flaw in the chart — it is the honest
            shape of randomness.
        </Term>

        <p>That widening is what makes the picture readable, because <strong>a real edge
            and a lucky streak grow at different speeds</strong>. A genuine edge earns the
            same amount per bet, so it climbs in a straight line. Luck only grows as fast
            as the band does, which is much slower. So a real edge pulls away from the
            band and keeps pulling away, while a lucky run gets swallowed back up as the
            band catches it.</p>

        <p>Look for the line <em>leaving the band and staying out</em>, not for the line
            going up.</p>

        <Term name="Blue line">
            Ended inside the band. No evidence of an edge, whatever shape it drew on the way.
        </Term>
        <Term name="Green line">
            Ended above the band — won more than chance comfortably explains.
        </Term>
        <Term name="Red line">
            Ended below the band — lost more than chance explains. This is the usual result,
            and it is not a bug: betting at break-even still bleeds the commission.
        </Term>

        <h3>The “By rule” chart</h3>
        <p>One row per rule, so you can see which rules carried the result and which dragged
            on it. A rule that fired rarely will have a very wide row — that is the chart
            telling you it does not yet know.</p>

        <Term name="The dot">
            How often that rule was right. Its exact figure is printed on the right.
        </Term>
        <Term name="The whiskers">
            The honest range the true rate could sit in. Wide whiskers mean few bets; they
            narrow slowly, needing four times the hands to halve.
        </Term>
        <Term name="The red upright tick">
            The rate <em>that particular rule</em> has to beat to stop losing money.
        </Term>

        <p>Each rule gets its own tick because the bar is not the same for everyone. Banker
            pays 0.95 to 1 after the commission, so a Banker call must be right
            <strong> 51.28%</strong> of the time to break even, while a Player call only
            needs <strong>50%</strong>. A rule that mostly calls Banker is therefore held to
            a higher standard, and can be above 50% while still losing.</p>

        <p>A rule is genuinely ahead only when its <strong>whole whisker</strong> sits to the
            right of its tick. A dot past the tick with whiskers straddling it means nothing
            yet. Dots turn green when the whole range clears the bar and red when the whole
            range is below it.</p>

        <h3>The settings</h3>
        <Term name="Rules">
            Which rules are allowed to bet. Hands where none of them fire are passed over —
            no bet, and they do not count against you.
        </Term>
        <Term name="pattern *">
            The only rule that reads the grid rather than just the run of results, which
            makes it around 250 times slower. The estimate beside the Run button accounts
            for it.
        </Term>
        <Term name="Bet the entire shoe / From–To">
            Which hands you actually bet on. Unticking it lets you sit out the start or end
            of a shoe — “from 20 to 70” means watching the first nineteen hands and betting
            the next fifty-one. The rules still <em>watch</em> every hand, exactly as you
            would at a table; the window only decides where money goes.
        </Term>
        <Term name="Cards">
            <strong>Dealt shoes</strong> uses eight real decks and baccarat’s actual drawing
            rules, so cards genuinely run out as the shoe goes on.
            <strong> Independent hands</strong> has the same odds but no memory at all.
            Running both is the test: if a rule set scores the same on each, then nothing
            in how the cards deplete is helping it.
        </Term>
        <Term name="Conflicts">
            Two rules can fire together and disagree. “Settled on track record” picks whichever
            has done better, as the live app does. “Not settled” measures the rules on their own
            without that machinery moving underneath them.
        </Term>
        <Term name="Seed">
            The starting point for the shuffle. The same settings and seed always give exactly
            the same answer, so a result can be checked rather than taken on trust. Change it
            to see a different set of shoes.
        </Term>

        <h3>The result table</h3>
        <Term name="Hands in window">
            Hands that fell inside your betting window. With the whole shoe selected this is
            nearly every hand dealt.
        </Term>
        <Term name="Bets placed">
            How often a rule actually fired. “Pushed” counts ties, where the stake comes back —
            neither a win nor a loss, so they stay out of the hit rate.
        </Term>
        <Term name="You would bet">
            The share of hands you would have money on. A low figure is not a problem; sitting
            out is the point of playing rules.
        </Term>
        <Term name="Hit rate">
            How often the call was right, with its honest range in brackets.
        </Term>
        <Term name="Per unit staked">
            Money rather than accuracy. −0.0125 means losing just over a penny for every pound
            risked. This can be negative while the hit rate is above 50%, which is the whole
            reason it is shown.
        </Term>
        <Term name="Above break-even">
            How far clear of the bar the result sits, counted in standard errors. Roughly: under
            2 is noise, over 3 is hard to explain as luck, and a negative figure means losing.
            It is the single most useful number on the screen.
        </Term>

        <h3>What this can and cannot settle</h3>
        <p>A flat result here is meaningful: it says the edge is not in the machinery of
            baccarat — not in the drawing rules, not in the cards running out. That narrows
            what is left to explain a good run on real hands.</p>
        <p>But it works in one direction only. The simulator deals a <em>model</em> of the game,
            so it can show an effect is absent from that model; it can never prove one exists at
            a real table. Only real hands can do that, and telling a genuine edge from a lucky
            streak takes roughly 800 bets.</p>
    </div>
);

export default SimHelp;
