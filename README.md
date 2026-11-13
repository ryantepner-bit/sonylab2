# SonyLab
Experimental digital camera emulation + image manipulation lab. See `docs/ARCHITECTURE.md` and `PROJECT_STATE.md`.

## Run
Requires Node 20+.
```
npm install
npm test          # engine tests (vitest)
npm run typecheck
npm run dev       # http://localhost:5173
npm run build
```
Open an image (or drop one), add effects from the left panel, select a node in the bottom chain to edit parameters, export from the toolbar.

## Windows .exe (Tauri) — scaffold, not yet built by the author
Prereqs: Node 20+, Rust (https://rustup.rs), Microsoft C++ Build Tools, WebView2 (preinstalled on Windows 11).
```
npm install
npx tauri icon app-icon.png     # generates src-tauri/icons from the placeholder; replace app-icon.png with your own art
npx tauri dev                   # desktop window with hot reload
npx tauri build                 # installer at src-tauri/target/release/bundle/nsis/*.exe
```
No Rust installed? Push the repo to GitHub and run the "build-windows" workflow (Actions tab); it uploads the installer as an artifact.
