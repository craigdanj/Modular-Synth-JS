# Changelog

## 1.0.1 — 2026-10-02

### Correctness fixes

- Sequencer steps are copied at start. Later mutations of the caller's array cannot change or corrupt playback. Sparse arrays are rejected before changing the running sequence.
- Delay mix changes cancel older future automation on both wet and dry gains.
- Patch loading builds an isolated rack before replacing the active one. Native allocation or connection failures preserve the existing patch and dispose temporary nodes.
- Failed module/cable construction cleans up partial Web Audio connections and sources.
- Non-string module types are rejected instead of creating empty modules.
- Play/Stop, Panic, preset loading, manual notes, and focus changes cancel pending sequencer starts while audio resumes.
- A slow import cannot overwrite a newer preset/import. Export rejects invalid sequencer settings rather than producing a patch that cannot be reimported.
- The synth survives browser back/forward cache navigation; final unload still disposes it.
- Panic uses a short envelope fade instead of abruptly setting the envelope to zero.

### Usability and documentation

- Added exact numeric entry for module parameters, with validation and recovery from invalid edits.
- Added logarithmic sliders for frequency, cutoff, envelope timing, LFO rate, and modulation amount/depth.
- Envelope amount and LFO depth now expose 0.01 precision in their parameter definitions.
- Resonance labels and documentation reflect native Web Audio units: dB for lowpass/highpass; Q for bandpass/notch.
- Updated the standalone demo, README, test instructions, and package version together.

### Compatibility

The runtime version is 1.0.1. The patch format remains 1.0.0. Existing patches, module types, port names, and public method signatures remain supported. Loading a patch still replaces its module objects and cables; obtain fresh references after loading.

### Verification

34 automated tests passed: 23 engine contract/regression tests and 11 demo event/state tests. JavaScript syntax and standalone asset assembly were checked.

The tests use Web Audio and DOM doubles. Browser rendering, real Web Audio DSP, and listening tests remain unverified because browser binaries could not be downloaded in the review environment. Seven OfflineAudioContext tests are included in `tests/audio-test.html` for running in a browser.

### Remaining design limits

The synth still uses one global monophonic note/gate path, and direct source-to-output patches can sound continuously. Voice allocation, independent pitch/gate routing, MIDI input, draggable modules, undo/redo, and recording remain future features. Module add/remove and cable patching are immediate operations and can still produce transients during active audio.
