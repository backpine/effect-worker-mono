# UI SDK

Before working with UI SDK, follow the `ui-sdk` skill if it is installed and read
`node_modules/@ui-sdk/react/docs/llms.txt` from `packages/ui`. Then read the
component pages for the parts you need.

When building a new primitive, search `node_modules/@ui-sdk/react/docs/core.md`
by heading and read `rendering.md` in the same directory.

Keep reusable React controls, component CSS, and design tokens in `packages/ui`.
Import controls from the explicit `@repo/ui` entry points. The React app owns
page layouts and imports the SDK stylesheet once in `apps/react-app/src/styles.css`.
