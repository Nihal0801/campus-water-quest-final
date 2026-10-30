# Campus Water Quest — Final Game

A responsive charity: water inspired game by Nihal Patel, developed with AI assistance from the [GCA-Classroom Water Quest starter](https://github.com/GCA-Classroom/05-cw-game-water-quest). The original prototype repository is preserved separately.

Collect yellow cans for +10 points. Avoid brown spills. Finish at or above the selected goal when the timer expires. Targets disappear after collection and cannot score twice.

| Difficulty | Time | Goal | Target interval | Can chance | Spill penalty |
| --- | --- | --- | --- | --- | --- |
| Easy | 40 sec | 80 | 1.5 sec | 90% | −5 |
| Normal | 30 sec | 100 | 1.2 sec | 80% | −5 |
| Hard | 25 sec | 140 | 0.85 sec | 70% | −10 |

Choose difficulty before a round or after results. Difficulty locks during play and pause. Reset restarts the current mode. Play again starts another round. Score never drops below zero; empty tiles and missed targets have no penalty. Reaching the goal early does not end the round: the final score determines the result.

Use mouse/touch, number keys 1–9, or native button controls. P pauses/resumes. Leaving the tab auto-pauses. Sound starts off; enable Sound on for original collection, spill, and victory effects. Arrays and conditionals track milestones at 25%, 50%, 75%, and 100% of the selected goal, once per round. Win confetti respects reduced motion.

Montserrat is loaded through Google Fonts as a geometric sans-serif that evokes the brand, with local sans-serif fallbacks. Supplied charity: water imagery and yellow/blue branding are retained. Footer links go to the official website and donation page. This student project is not an official partnership; points are not donations or water delivered.

Open index.html directly, or serve this directory using a static server. No build or installation required. Run lifecycle and difficulty checks with `node tests/game.test.cjs`.

Sources: [starter and image assets](https://github.com/GCA-Classroom/05-cw-game-water-quest), [brand resources](https://www.charitywater.org/about/media), [clean water and education](https://www.charitywater.org/global-water-crisis/education). Audio WAV files are original synthesized tones created for this project.
