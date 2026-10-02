# Modular Synth JS

A dependency-free, monophonic modular synthesizer built on the Web Audio API. Version **1.0.1**. Existing version `1.0.0` patch files remain compatible.

Create modules, connect typed audio and control ports, change parameters, and play notes. The engine has no DOM dependency; the included interface is a separate demo.

## Features

- Nine module types: oscillator, noise, filter, VCA, envelope, LFO, mixer, delay, and output.
- Typed audio and CV patch connections with validation.
- Four oscillator/LFO waveforms and four filter modes.
- Linear ADSR envelopes, additive modulation, and a three-input mixer.
- Delay with adjustable time, feedback, and dry/wet mix.
- Monophonic keyboard with last-note priority.
- Sixteenth-note sequencer with rests, tempo, and gate control.
- Live oscilloscope and output peak display.
- Three sound presets plus a blank canvas.
- JSON patch import/export, parameter smoothing, master compression, and panic mute.
- No runtime dependencies or build step.

## Getting started with the demo

1. Extract the ZIP archive if you downloaded the full package.
2. Open `modular-synth-standalone.html` in a browser that supports Web Audio. It contains the engine, interface, and styles in one file. Alternatively, open `index.html` with `modular-synth.js`, `demo.js`, and `demo.css` beside it.
3. Click **Enable audio**. The status changes to **Audio running** when the audio context starts.
4. The demo initially loads **Acid current**. Hold a key on the on-screen keyboard to hear it, or press **Play** in the sequencer.
5. Adjust the module sliders while listening, or type an exact value into the number field beside a control and commit it by leaving the field or pressing Enter. Start with the filter's **cutoff**, then try **resonance**, envelope **decay**, and **release**.

The demo runs locally and does not require an internet connection. A suspended audio context can also be resumed by playing a keyboard note or starting the sequencer. If an embedded file preview does not allow audio, download the HTML and open it in a full browser window.

Frequency, cutoff, envelope timing, LFO rate, and modulation amount/depth sliders use logarithmic scaling for finer control at small values. Number fields accept exact parameter values and restore the previous value if an edit is invalid.

## Using the demo page

### 1. Choose a starting patch

Select a patch in the **PATCH** menu, then click **Load**. Selecting a menu item alone does not load it.

| Preset | Patch design | Try this |
| --- | --- | --- |
| **01 / Acid current** | Sawtooth oscillator, resonant lowpass filter, short amplitude envelope, separate filter envelope, and LFO | Run the sequencer; adjust filter cutoff, resonance, and the `sweep` envelope's amount. |
| **02 / Soft orbit** | Triangle oscillator, gentle lowpass filter, longer amplitude envelope, and slow LFO | Hold keyboard notes; increase attack and release for a softer sound. |
| **03 / Cosmic drift** | Sawtooth oscillator, slow filter modulation, long envelope, and feedback delay | Hold a note, release it, and listen to the tail. Try delay time, feedback, and mix. |
| **04 / Blank canvas** | One output module with no cables | Build your own voice using the walkthrough below. |

Loading a preset replaces the rack and stops playback. It leaves the sequencer's note selections, tempo, and gate settings as they are. Export your current patch first if you want to keep it.

### 2. Play the keyboard

Click and hold an on-screen key, touch and hold it, or use the computer keyboard. Release the key to release the amplitude envelope.

| Computer key | Note at the default C3 octave |
| --- | --- |
| A | C3 |
| W | C♯3 |
| S | D3 |
| E | D♯3 |
| D | E3 |
| F | F3 |
| T | F♯3 |
| G | G3 |
| Y | G♯3 |
| H | A3 |
| U | A♯3 |
| J | B3 |
| K | C4 |

The **OCTAVE** selector changes the keyboard's starting note to C2, C3, C4, or C5. This changes the playable keyboard range; it does not transpose sequencer steps.

The synth is **monophonic**. If you hold several notes, the most recently pressed note sounds. Releasing that note returns to the previous held note without retriggering the envelope. All oscillator modules follow the same played note, with their own detune settings.

Computer-key shortcuts pause while a slider, select menu, or text/number input has focus. Click outside the control before playing. Manual keyboard playback stops a running sequencer. Switching tabs or moving focus away from the browser window also stops sequencing and releases held notes.

### 3. Add and remove modules

Choose a module in the module menu, then click **+ Add module**. Each card shows its type, generated ID, controls, and ports. Modules are created with their default parameter values and no external cables.

Click the **×** in a module's header to remove it. Removing a module also removes every cable attached to it. You can create several modules of the same type, up to 64 modules in total.

Adding modules does not automatically route them to the output. An oscillator must have an audio path to an output module before it can be heard.

### 4. Patch the ports

Ports appear at the bottom of each module card. Inputs are on the left; outputs are on the right.

| Port color | Signal | Examples |
| --- | --- | --- |
| **Teal** | Audio | Oscillator `out` → Filter `in`; VCA `out` → Output `in` |
| **Amber** | Control voltage / CV | Envelope `out` → VCA `gain`; LFO `out` → Filter `cutoff` |

To create a cable:

1. Click an output port.
2. Click a compatible input port.
3. Check the rack for the cable and the confirmation message above it.

You can also select the input first, then the output. Click the selected port again or press **Escape** to cancel. Clicking another port on the same side changes the selection.

Audio connects to audio and CV connects to CV. Incompatible ports, duplicate cables, and user-created feedback cycles are rejected. Use the Delay module for a controlled echo feedback loop. A single output may connect to several inputs, and several outputs may feed one input; incoming signals sum.

Expand **Patch connections** below the rack to inspect the routes. Click the **×** next to a route to disconnect it. The demo creates cables with a scale factor of 1; custom scaling or inversion is available through the plugin API.

### 5. Build your first patch from scratch

Load **Blank canvas**, which already contains an Output module. Then add one **Oscillator**, **Filter**, **VCA**, and **Envelope**.

Create these four connections:

| From | To | Purpose |
| --- | --- | --- |
| Oscillator `out` | Filter `in` | Send the raw waveform into the filter. |
| Filter `out` | VCA `in` | Send the shaped audio into the amplifier. |
| Envelope `out` | VCA `gain` | Open and close the amplifier for each note. |
| VCA `out` | Output `in` | Send the articulated sound to the master output. |

Use these initial settings:

- **Oscillator:** wave `sawtooth`, level `0.5`.
- **Filter:** type `lowpass`, cutoff `1400 Hz`, resonance `2`.
- **VCA:** gain `0`. The envelope supplies the gain while a note is active.
- **Envelope:** attack `0.01 s`, decay `0.2 s`, sustain `0.5`, release `0.3 s`, amount `1`.
- **Output:** volume `0.35`.

Hold a keyboard note. You should hear the oscillator through the filter, shaped by the envelope. Release the key and the sound should fade over the release stage.

If you connect an oscillator directly to Output, it sounds continuously. Note events change its pitch, but the oscillator needs an envelope-controlled VCA to start and stop with the keyboard.

### 6. Shape the sound

| Control | What it changes |
| --- | --- |
| Oscillator **wave** | The waveform and its harmonic character. |
| Oscillator **frequency** | The oscillator's base frequency. Playing a note overrides it; the slider continues to show its stored parameter value. |
| Oscillator **detune** | Pitch offset in cents. 100 cents equals one semitone. This offset remains when notes are played. |
| Oscillator / Noise **level** | The source's output amplitude. |
| Filter **cutoff** | Filter frequency. Lowering a lowpass cutoff generally darkens the sound. |
| Filter **resonance** | Native Web Audio resonance: dB for lowpass/highpass; dimensionless Q for bandpass/notch. The label follows the selected filter type. |
| Envelope **attack** | Time to rise from the current envelope level to its peak after a note starts. |
| Envelope **decay** | Time to fall from the peak to the sustain level. |
| Envelope **sustain** | Level maintained while a note remains held, as a fraction of the envelope peak. |
| Envelope **release** | Time to return to zero after the note is released. |
| Envelope **amount** | Peak CV output, in the destination parameter's units. |
| LFO **rate** | Modulation speed in Hz. |
| LFO **depth** | Peak positive/negative modulation amplitude. |
| Delay **time** | Echo delay in seconds. |
| Delay **feedback** | How much delayed signal is fed back for further repeats. |
| Delay **mix** | Balance between the original and delayed audio. |
| Output **volume** | Level sent to the master compressor and analyser. |

For filter movement, add an LFO, connect its amber `out` to the filter's amber `cutoff`, and start with rate `0.5 Hz` and depth `200`. CV is additive: with a 1400 Hz cutoff, a ±200 Hz LFO varies the cutoff around that base frequency.

For vibrato, connect an LFO to the oscillator's `pitch` input. A depth of `20` means ±20 cents. The oscillator's `fm` input uses Hz instead.

For a plucked sound, lower envelope sustain toward zero and use a short attack and decay. For a swelling sound, increase attack and release. Envelope parameter changes affect subsequent gate events; they do not rewrite an already scheduled envelope stage.

### 7. Program the step sequencer

The demo has **16 steps**, each representing a sixteenth note.

1. Select a note for each step. Available notes run from **C2 to C6**.
2. Select **—** for a rest.
3. Set **TEMPO** between 30 and 300 BPM.
4. Set **GATE** between 5% and 95% of a step's duration.
5. Click **▶ Play**. While audio is starting, the button becomes **■ Cancel**; clicking it cancels that pending start. Once running, the highlighted step indicates the current position.
6. Click **■ Stop** to stop and release the envelopes.

For example, at 120 BPM each step lasts 0.125 seconds. A 65% gate holds the note for about 0.081 seconds before starting its envelope release. Release and delay tails may continue into later steps and rests.

The sequencer loops all 16 steps. Notes, tempo, and gate settings are captured when Play is pressed. After editing them during playback, press Stop and Play to hear the changes. Module parameter sliders remain live while it runs.

### 8. Read the oscilloscope

The oscilloscope displays the master output waveform after compression. The peak label shows:

- **SILENT** when the measured output is near zero.
- A **dBFS** reading when a signal is present.
- **HIGH LEVEL** when the measured peak is close to full scale.

Use it to compare waveforms, envelope articulation, and modulation. It is a waveform display, not a spectrum analyser. A flat trace while the keyboard and sequencer are idle is normal for an envelope-controlled patch.

### 9. Save and reload your patch

Click **Export patch** to download `modular-synth-patch.json`. Demo exports contain the module types, IDs, parameters, cables, sequencer notes, tempo, and gate setting.

Click **Import patch**, choose the JSON file, and the demo replaces the current rack with that patch. Files must be valid version `1.0.0` patches and no larger than 1 MB. When demo sequencer settings are present, they must contain 16 valid notes/rests and valid tempo/gate values.

Exports do not capture active notes, playback position, delay-buffer contents, the keyboard octave selection, or the preset-menu selection. There is no automatic save or undo history; export a patch before replacing it.

### 10. Stop a stuck or continuous sound

Click **Panic**. It stops the sequencer, cancels a pending Play request, clears held notes, and fades envelopes and master output over a few milliseconds to reduce clicks. Play a new keyboard note or start the sequencer to unmute. Clicking Enable audio alone resumes the audio context and does not clear panic mute.

Delay tails are muted at the master rather than erased from the delay buffer. They continue decaying internally.

## Demo troubleshooting

| Problem | What to check |
| --- | --- |
| No sound | Enable audio, play a note or the sequencer, check Output volume, and confirm a complete audio path to an Output module. |
| Still silent after Panic | Play a new note or press Play to unmute. |
| Oscillator runs constantly | Route its audio through a VCA; set VCA gain to 0 and connect an Envelope to its gain input. |
| Envelope or LFO cannot connect to an audio input | CV must connect to an amber CV input. |
| A cable is rejected | Check port types, duplicate routes, and graph cycles. Use Delay for feedback effects. |
| Computer keys do nothing | Click outside sliders, text inputs, and dropdowns so the shortcuts can receive key presses. |
| Sequencer edits do not change playback | Press Stop and Play; the running sequence uses settings captured at start. |
| New modules are silent | New modules have no cables. Add their audio and CV connections explicitly. |
| Extra oscillators sound at the same pitch | Note playback addresses every oscillator. Detune them for layering; use the Mixer to combine them. |
| A preset change loses the current rack | Loading replaces the rack. Export before loading another preset. |
| A sound is harsh or too loud | Reduce source levels, mixer gains, resonance, modulation amount, feedback, or Output volume. The compressor is not a brick-wall limiter. |
| Playback stops when changing tabs | The demo deliberately stops sequencing and releases held notes when hidden or unfocused. |

## Include the plugin

```html
<script src="modular-synth.js"></script>
<button id="start">Play a note</button>
<script>
const synth = new ModularSynth();
synth.create('oscillator', { wave: 'sawtooth', level: 0.5 }, 'osc');
synth.create('filter', { cutoff: 1400, resonance: 2 }, 'filter');
synth.create('vca', { gain: 0 }, 'amp');
synth.create('envelope', {
  attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3
}, 'env');
synth.create('output', { volume: 0.35 }, 'out');

synth.connect('osc', 'out', 'filter', 'in');
synth.connect('filter', 'out', 'amp', 'in');
synth.connect('env', 'out', 'amp', 'gain');
synth.connect('amp', 'out', 'out', 'in');

document.querySelector('#start').addEventListener('click', async () => {
  await synth.resume(); // Resume audio from a user gesture.
  const time = synth.context.currentTime;
  synth.noteOn(60, time);
  synth.noteOff(60, time + 0.5);
});
</script>
```

The UMD file also supports CommonJS bundlers (`require('./modular-synth.js')`). A browser or supplied Web Audio context is needed to construct a synth; Node alone does not provide Web Audio.

## Modules and ports

| Type | Parameters | Inputs | Outputs |
| --- | --- | --- | --- |
| `oscillator` | `wave`, `frequency`, `detune`, `level` | audio-rate CV `fm` (Hz), `pitch` (cents) | audio `out` |
| `noise` | `level` | — | white-noise audio `out` |
| `filter` | `type`, `cutoff`, `resonance` | audio `in`; CV `cutoff` (Hz), `resonance` (native Q units) | audio `out` |
| `vca` | `gain` | audio `in`; CV `gain` | audio `out` |
| `envelope` | `attack`, `decay`, `sustain`, `release`, `amount` | note events via the API | unipolar CV `out` |
| `lfo` | `wave`, `rate`, `depth` | — | bipolar CV `out` |
| `mixer` | `a`, `b`, `c` | audio `a`, `b`, `c` | summed audio `out` |
| `delay` | `time`, `feedback`, `mix` | audio `in` | audio `out` |
| `output` | `volume` | audio `in` | master compressor and analyser |

Waveforms: sine, triangle, sawtooth, square. Filter types: lowpass, highpass, bandpass, notch. Durations use seconds. Frequencies use Hz. Sustain, audio levels, mix, feedback, and VCA gain are linear values. The `resonance` control directly maps to Web Audio’s `BiquadFilterNode.Q`: lowpass/highpass interpret it in dB; bandpass/notch use dimensionless Q. See the [Web Audio Q documentation](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/Q). The LFO's depth is the peak amplitude in the destination port's units. Envelopes produce a linear ADSR shape from 0 to `amount`.

`ModularSynth.definitions` supplies a copy of all defaults, ranges, step sizes, port types, and choices for building a custom UI.

### Modulation

```js
synth.create('lfo', { rate: 5, depth: 25 }, 'vibrato');
synth.connect('vibrato', 'out', 'osc', 'pitch'); // ±25 cents

synth.create('envelope', { amount: 1800, sustain: 0 }, 'sweep');
synth.connect('sweep', 'out', 'filter', 'cutoff'); // Add up to 1800 Hz

synth.set('filter', 'cutoff', 500);
```

CV is **additive** to the destination parameter's base value. Set a VCA's gain to zero when an envelope should fully close it. Several connections to the same input sum. The optional fifth `connect` argument scales or inverts the cable (`-1` inverts it). To change cable amount, disconnect the returned connection and reconnect it.

## Common plugin recipes

### Layer two oscillators

The following extends the voice from the inclusion example. Remove the original oscillator-to-filter route and put a mixer before the filter:

```js
const originalRoute = synth.connections.find(connection =>
  connection.from === 'osc' && connection.to === 'filter'
);
if (originalRoute) synth.disconnect(originalRoute);

synth.create('oscillator', {
  wave: 'sawtooth', level: 0.35, detune: 7
}, 'osc2');
synth.create('mixer', { a: 0.6, b: 0.6, c: 0 }, 'mix');

synth.connect('osc', 'out', 'mix', 'a');
synth.connect('osc2', 'out', 'mix', 'b');
synth.connect('mix', 'out', 'filter', 'in');
```

Both oscillators follow the played MIDI note. The second stays 7 cents sharp. Keep mixer gains moderate because input signals sum.

### Add delay after the VCA

```js
const dryRoute = synth.connections.find(connection =>
  connection.from === 'amp' && connection.to === 'out'
);
if (dryRoute) synth.disconnect(dryRoute);

synth.create('delay', {
  time: 0.25, feedback: 0.3, mix: 0.25
}, 'echo');
synth.connect('amp', 'out', 'echo', 'in');
synth.connect('echo', 'out', 'out', 'in');
```

The Delay module already combines dry and wet audio. Removing the original VCA-to-output route prevents an extra parallel dry path.

### Disconnect or invert modulation

```js
const previous = synth.connections.find(connection =>
  connection.from === 'vibrato' && connection.to === 'osc' &&
  connection.input === 'pitch'
);
if (previous) synth.disconnect(previous);

const modulation = synth.connect('vibrato', 'out', 'osc', 'pitch', 0.5);
synth.disconnect(modulation);
const inverted = synth.connect('vibrato', 'out', 'osc', 'pitch', -0.5);
// Later:
synth.disconnect(inverted);
```

### Release resources

```js
await synth.destroy();
```

Call this when removing the synth from your app. It stops sources, disconnects nodes, cancels sequencer timers, and closes the context only if the engine created it.

## API

| Method | Behavior |
| --- | --- |
| `new ModularSynth({ context?, destination? })` | Create an engine, optionally sharing an existing context and destination. A newly created context is owned by the engine. |
| `await resume()` | Resume a suspended context. Call from a click or other user gesture. |
| `create(type, params?, id?)` | Create and return a module. An omitted ID is generated. |
| `get(id)` | Return the module object. Treat its internal nodes and metadata as read-only unless intentionally integrating native Web Audio. |
| `set(id, parameter, value, time?)` | Set a validated parameter; numeric controls smooth over about 10 ms. Times use AudioContext seconds. Past times clamp to now. Waveform and filter-type changes apply immediately. |
| `connect(from, output, to, input, amount = 1)` | Return a connection object. Typed ports, duplicates, and graph cycles are validated. |
| `disconnect(connection)` | Remove that connection; return whether it existed. |
| `remove(id)` | Stop and disconnect a module and its attached cables. |
| `noteOn(midiNote, time?)` | Set every oscillator to the MIDI pitch, preserving detune, and trigger every envelope. Unmute the master. |
| `noteOff(midiNote?, time?)` | Release a held note. With no argument, release all notes. The most recently held note has priority. |
| `startSequencer({ steps?, bpm?, gate?, onStep? })` | Run sixteenth notes with a 25 ms lookahead scheduler. A step is a MIDI number or `null` for a rest. |
| `stopSequencer()` | Cancel pending step callbacks and note schedules, release envelopes, and clear held notes. Effect tails may continue. |
| `panic()` / `unmute()` | Immediately stop and mute; explicitly restore the master. |
| `toJSON()` / `loadPatch(patch)` | Serialize or replace the graph. Validate and construct the replacement in an isolated rack. Validation or native node/connection failures leave the existing graph intact. |
| `ModularSynth.validatePatch(patch)` | Validate without creating audio nodes. |
| `ModularSynth.midiToFrequency(note)` | Convert MIDI to Hz; A4 / MIDI 69 = 440 Hz. |
| `await destroy()` | Dispose nodes and timers. Close an owned context; leave a supplied context open. |

Use `synth.analyser` with native Web Audio analyser methods for meters or scopes. `synth.context` exposes the audio clock. Do not mutate `synth.modules`, `synth.connections`, or module metadata directly.

```js
synth.startSequencer({
  steps: [48, 55, 60, null, 48, 58, 55, null],
  bpm: 110,
  gate: 0.65,
  onStep: index => console.log('Step', index)
});

const patch = synth.toJSON();
localStorage.setItem('my-patch', JSON.stringify(patch));
synth.loadPatch(JSON.parse(localStorage.getItem('my-patch')));
```

The sequencer makes its own dense copy of the steps and captures its settings at start. Mutating the original array does not change playback; sparse arrays and invalid notes are rejected. Restart to apply edits. `onStep` is a UI callback and can be delayed by the browser; audio timing uses the audio clock. The demo stops notes and sequencing when hidden or unfocused.

## Scope and limits

- **Monophonic** note control. Multiple oscillator modules layer one voice; they do not add polyphony.
- Notes globally address all oscillators and all envelopes. Gate events are API events, not patchable electrical gate signals. Note playback overrides each oscillator's base frequency until manually changed.
- Live held-note priority is evaluated when API calls are made. For future notes, schedule each `noteOn` and matching `noteOff` in chronological order, or use the built-in sequencer. Do not mix manual notes with an independently running sequencer; the demo stops sequencing before manual playback.
- Up to **64 modules** and **256 cables**. Imported patches must use version `1.0.0`.
- User graph feedback cycles are rejected. The delay module includes its own bounded feedback loop.
- The master compressor reduces large peaks; it is not a brick-wall limiter. Large CV amounts or summed audio can still produce harsh or overdriven results. Keep output levels moderate.
- No MIDI device integration, polyphony, recording, sample loading, custom module registration, or VST support in this release.
- Intended for modern desktop and mobile browsers with Web Audio, ConstantSourceNode, and ResizeObserver. Browser permissions may require opening the demo in a full browser window rather than an embedded preview.

## Files

- `modular-synth.js` — reusable engine.
- `index.html`, `demo.js`, `demo.css` — editable demo source.
- `modular-synth-standalone.html` — same demo with all assets embedded.
- `tests/engine.test.cjs` — engine contract tests using a Web Audio test double.
- `tests/demo.test.cjs` — demo event/state regressions using a minimal DOM harness.
- `tests/web-audio-mock.cjs`, `tests/demo-harness.cjs` — dependency-free test helpers; they do not render sound or layout.
- `tests/audio-test.html` — real browser DSP tests using OfflineAudioContext.
- `CHANGELOG.md` — fixes and validation details for this release.
- `LICENSE` — MIT license.

Run the contract tests with Node 18+:

```sh
npm test
# Or, without npm:
node --test tests/engine.test.cjs tests/demo.test.cjs
```

Open `tests/audio-test.html` and press **Run audio tests** for seven real-audio checks covering voice output/release, interrupted and retriggered ADSR ramps, LFO amplitude/frequency, delay timing/mix automation, and filtered noise. For browser QA, also exercise presets, port patching, touch/keyboard release, sequencer stop, import/export, and desktop/mobile layout.

### Validation of this package

All **34 automated tests passed**: 23 engine contract/regression tests and 11 demo event/state tests. These use Web Audio and DOM test doubles; they verify control logic, not sound quality or browser layout. Browser DSP and visual tests could not be run there because no browser binary was available and both the full-browser and headless-shell downloads failed. The audio test page is included for verification in your browser.

## License

MIT.
