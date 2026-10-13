# Fixed tasks (locked before any run; identical prompts for Run A and Run B)

Repo: https://github.com/mrdoob/three.js at tag r179 (commit 54ac263), shallow clone.
Model: claude-sonnet-5-5 (alias "sonnet"), one fresh headless session per task (`claude -p`, new --session-id), cwd = repo root.

- (a) Where is the GLTFLoader's handling of KHR_materials_transmission, and which function applies it?
- (b) List every file that imports BufferGeometryUtils.
- (c) Explain how WebGLRenderer decides the shadow map type.
- (d) Find the code path that disposes textures when a material is disposed.
- (e) Add a one-line comment above the main export of src/core/Object3D.js (do not commit).

Each prompt is sent verbatim as the user message, with no extra instructions.
