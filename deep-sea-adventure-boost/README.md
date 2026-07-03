# Deep Sea Adventure · Air Supply 🤿

A cute, single-file web app that tracks the shared **air supply** for the board
game [Deep Sea Adventure](https://www.oinkgames.com/en/games/analog/deep-sea/) —
built around the "boost" house rule.

A cartoon submarine floats at the surface with air hoses trailing down into the
ocean while bubbles drift up from the sea floor. A big oxygen gauge starts at
**25**.

## How it works

- **Dive** — subtracts **1** from the air supply.
- **Boost** — subtracts **2** from the air supply.
- When the air runs out, the bubbles stop rising, the counter turns **red**, and
  a **Resurface** button appears to reset everything back to 25.

## Run it

It's a single, dependency-free HTML file. Just open it:

```bash
open index.html
```

Or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

No build step, no dependencies — pure HTML, CSS, and vanilla JavaScript.
