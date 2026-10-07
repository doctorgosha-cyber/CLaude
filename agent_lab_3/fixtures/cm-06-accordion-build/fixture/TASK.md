Our accordion component stopped behaving after the r214 refactor and the demo page now shows every panel open.
Please fix accordion.mjs and accordion.css so that the behaviour matches SPEC.md and the tests pass (node --test tests/accordion.test.mjs).
Keep the public API and the markup contract in SPEC.md; do not change the test file.
I think the ArrowDown handler is broken too, so check it while you are there.
Report what was wrong, what you changed and why, one numbered finding per root cause with severity.
