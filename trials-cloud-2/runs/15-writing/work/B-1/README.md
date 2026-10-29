# Task: rewrite the NEXUS solo-agent role card

`ROLE-CARD.md` in this folder is the system instruction given to the NEXUS "solo" build agent at the start of every run. It has grown by accretion (four revisions, two incident write-ups, legacy notes) and is now long, repetitive and in places self-contradicting. Agents reading it miss rules.

## What to deliver

Write `ROLE-CARD.rewritten.md` next to the original: a rewrite of `ROLE-CARD.md` for **compactness and clarity for an agent reader**.

- Keep **every operational rule** the current card imposes on the agent (what to do, what not to do, formats, vocabularies, stop conditions). Where the card contradicts itself, keep the resolution the card itself states (later section wins; LEGACY loses).
- Drop history, anecdotes, motivation and duplication that do not change what the agent does.
- The rewritten card will be used verbatim as the agent's system instruction and judged by how reliably agents follow the rules when working from it, and by its size in tokens. Shorter is better only if nothing operational is lost.
- Markdown, plain text, one file. Do not change `ROLE-CARD.md` itself.

## Constraints

- Aim for under 15 minutes of work.
- Do not install packages or use the network. There is nothing to run; this is a writing task.
- Work only inside this folder.
