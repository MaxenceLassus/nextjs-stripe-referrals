CI runs `typecheck` and `test`. Neither needs a database, a network, or a Stripe key.

The live Stripe round trip is deliberately not automated: it needs a real test key,
and a public repository is not the place to keep one. The manual checklist is in the
root README under "What is tested, and what is not".
