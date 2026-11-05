# @needle-tools/simready

Load articulated glTF assets, manipulate joints, and simulate independently loaded assets in a shared world. The runtime also accepts physics descriptors from USD or code. It runs in browsers and Node.

```sh
npm install @needle-tools/simready three
```

Create one controller for an asset and keep it while the asset is in use. Choose
joint posing for direct manipulation, or dynamics for gravity and contacts. The
examples show these as alternatives; loading an asset does not start either one.

## glTF extension specification

The [NEEDLE_simready specification](extensions/NEEDLE_simready/README.md)
defines the versioned data contract, glTF coordinates, semantic metadata,
reference handling and related glTF extensions. It includes
[JSON Schemas](extensions/NEEDLE_simready/schema/glTF.NEEDLE_simready.schema.json)
and self-contained examples.
See the [implementation notes](extensions/NEEDLE_simready/implementation.md)
for SimReady Foundation capability mapping, current gaps and the glTF 2.1
core-shape draft.

The [USD export guide](docs/usd-export.md) covers converting a composed stage,
preserving its simulation data, and loading the result in a glTF application.

## Three.js

Register the extension on your `GLTFLoader` before loading a SimReady GLB. In an
existing Three.js application, `scene` below is your render scene:

```js
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {registerSimreadyLoader, getSimreadyRuntime} from '@needle-tools/simready/gltf';

const asset = await registerSimreadyLoader(new GLTFLoader()).loadAsync('/assembly.glb');
scene.add(asset.scene);
const runtime = getSimreadyRuntime(asset);
```

For joint posing, create a mechanism once:

```js
const mechanism = await runtime.createMechanism();
mechanism.setJointValue('/Assembly/Hinge', 45);
```

Loading preserves the resting pose and starts no solver. Kinematics loads on demand and handles limits, fixed attachments, mimic relationships and closed linkages. Hinge controls use degrees; slider controls use metres.

Use the joint paths stored in your asset; `/Assembly/Hinge` and `/Assembly/Slide`
are examples. `runtime.snapshot` contains the bodies, colliders and joints in glTF metres and radians, and
`runtime.usdMetadata` contains the retained schema metadata.

For dynamics without an existing physics host, install Rapier:

```sh
npm install @dimforge/rapier3d-compat
```

Initialize it once, then attach the loaded asset to a world. This is the dynamics
alternative to creating a mechanism:

```js
import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '@needle-tools/simready/rapier';

await R.init();
const world = createSimulationWorld({rapier: R});
const assembly = await runtime.createSimulation({world, id: 'assembly'});

// Advance the shared world from your fixed-step loop.
world.step(1 / 120);
assembly.setJointTarget('/Assembly/Slide', {position: .3});
```

Meshes update when the world steps. Attach additional assets with their own IDs
to get contacts between them. The application still owns the Three.js scene,
geometries, materials and textures.

## Needle Engine

Inside a Needle `Behaviour`, use `this.context` as `context` in these examples.
Register the SimReady extension with Needle's glTF import hook once during
application setup, then use the normal Engine asset loader:

```js
import {addCustomExtensionPlugin, loadAsset} from '@needle-tools/engine';
import {registerSimreadyLoader, getSimreadyRuntime} from '@needle-tools/simready/gltf';

const simreadyPlugin = {
  name: 'SimReady',
  onImport(loader) { registerSimreadyLoader(loader); },
};
addCustomExtensionPlugin(simreadyPlugin);

const asset = await loadAsset('/assembly.glb', {context});
context.scene.add(asset.scene);
const runtime = getSimreadyRuntime(asset);
```

For joint posing without Rapier:

```js
const mechanism = await runtime.createMechanism();
mechanism.setJointValue('/Assembly/Hinge', 45);
```

This preserves Needle's other glTF import plugins and keeps SimReady registration
separate from the USD plugin. Loading an asset or creating a mechanism does not
initialize Rapier.

For dynamics instead of joint posing, use the Needle adapter. It starts Needle's
physics when needed and creates the asset's bodies, colliders and joints with
Engine's `physics.createAsset`:

```js
import {createNeedleSimulationWorld} from '@needle-tools/simready/needle';

const world = await createNeedleSimulationWorld({context});
const assembly = await runtime.createSimulation({world, id: 'assembly', position: [0, 0, 0], rotation: [0, 0, 0, 1]});
```

Needle steps the physics and moves the asset in its normal update loop, so don't call
`assembly.update()` or `assembly.step()`. Keep the adapter on the owning component for
as long as the assets are in use. When Engine clears its physics world, it disposes the
adapter's assets first.

SimReady converts the asset into a description in world units: shapes, USD mass
values, joint frames, limits, drives, articulations and collision filters. Engine
creates the physics objects and their components, and handles raycasts, collision
callbacks and cleanup. `world.capabilities` shows what the current physics backend
supports. Anything it can't simulate is listed in `assembly.unsupported`.

`assembly.rigidbodies` and `assembly.colliderComponents` map body and collider paths
to their Engine components. `assembly.bodies` has the same pose and velocity methods as
the standalone adapter. Instanced or ambiguous render objects get their own Engine
objects. Reset keeps the components; unloading removes the components and physics
objects. Standalone Rapier and kinematics imports still don't need Engine.

Explicitly disabling the Engine Rapier backend also disables this dynamics path; the adapter does not load a second runtime to override that choice.

### USD assets in Needle

Register the USD plugin once before loading USD files. The `asset` returned by
Needle's loader exposes the same Hydra handle used by the USD SDK. Install
`@needle-tools/usd` and follow its [runtime requirements](https://github.com/needle-tools/usd-viewer/tree/main/usd-wasm#runtime-requirements)
for the threaded WebAssembly runtime:

```js
import {loadAsset} from '@needle-tools/engine';
import {addPluginForNeedleEngine, getHydraHandleFromNeedleEngineAsset} from '@needle-tools/usd/plugins';
import {createUsdMechanism} from '@needle-tools/usd/kinematics';

const removeUsdPlugin = await addPluginForNeedleEngine({getFiles: () => []});
const asset = await loadAsset('/cabinet.usd', {context});
context.scene.add(asset.scene);
const handle = getHydraHandleFromNeedleEngineAsset(asset);
```

For joint posing:

```js
const mechanism = await createUsdMechanism({handle});
mechanism.setJointValue('/Cabinet/Hinge', 45);
```

For dynamics instead, attach the USD handle to the Engine world adapter from the
previous example:

```js
import {createUsdPhysics} from '@needle-tools/usd/physics';

const cabinet = await createUsdPhysics({handle, world, id: 'cabinet', allowPartial: false});
```

The USD adapters read the composed stage, bind bodies to rendered instances and
pause timeline playback while they control the poses. They use this package's
controllers.

## From code, without a renderer

Physics descriptors can be created directly in JavaScript. This complete Node
example drops a box onto a floor; it needs no USD file, browser or scene graph:

```js
import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '@needle-tools/simready/rapier';

await R.init();
const snapshot = {
  metersPerUnit: 1, kilogramsPerUnit: 1, upAxis: 'Y',
  scenes: [], materials: [], groups: [], joints: [], unsupported: [],
  bodies: [{
    path: '/Box', position: [0, 2, 0], rotation: [0, 0, 0, 1],
    mass: 1, rigidBodyEnabled: true,
  }],
  shapes: [{
    path: '/Box/Collider', body: '/Box', type: 'cube',
    position: [0, 0, 0], rotation: [0, 0, 0, 1], halfExtents: [.5, .5, .5],
  }, {
    path: '/Floor', body: '', type: 'cube',
    position: [0, -.5, 0], rotation: [0, 0, 0, 1], halfExtents: [5, .5, 5],
  }],
};

const world = createSimulationWorld({rapier: R});
try {
  const box = await world.addAsset({id: 'box', snapshot});
  for (let frame = 0; frame < 240; frame++) world.step(1 / 120);
  console.log(box.bodies.get('/Box').body.translation()); // y is about 0.5
} finally {
  world.dispose();
}
```

`createMechanism({snapshot})` from `/kinematics` also accepts code-authored bodies
and joints, without Rapier. Use `setJointValue(path, value)` to pose them and read
the results from `mechanism.bodies`. For Three.js visuals, pass a `bindVisuals`
callback using the `/three` entry's explicit `{object, body, instanceIndex?}`
bindings. It preserves each visual's initial offset from its owning body.

## Controller lifetime

A mechanism stays alive across joint changes and drag gestures. Use
`setJointValue()` repeatedly, or `beginDrag()`, `moveDrag()` and `endDrag()` for
pointer interaction. `endDrag()` finishes a gesture without destroying the
mechanism. `play()` enables dragging; `pause()` stops dragging while keeping the
controller available.

Dispose a controller when unloading or replacing its asset, or when changing
that asset from joint posing to dynamics. Both controllers move the same parts,
so they cannot control the same visual root at once. For an explicit mode switch:

```js
mechanism.dispose();
const assembly = await runtime.createSimulation({world, id: 'assembly'});
```

Disposal restores the original poses and releases the controller's bindings. It
does not delete the asset's meshes, materials or textures. `assembly.dispose()`
removes that simulation asset; `world.dispose()` removes all assets attached
through the adapter. A borrowed Needle world and its other bodies remain alive.
In a Needle `Behaviour`, put this cleanup in `onDestroy()`, once at the end of
the component's lifetime.

For USD, dispose the controller before unloading or recomposing the stage.
Loader registrations last for the application: use
`removeCustomImportExtensionType(simreadyPlugin)` when unregistering the glTF
plugin, or `removeUsdPlugin()` when unregistering the USD plugin.

## Coordinates and stepping

| Controller | Linear units | Advancement |
| --- | --- | --- |
| Mechanism | Source stage units | `setJointValue()` |
| Owned simulation world | World units, metres by default | `world.step(dt)` |
| Borrowed world, including Needle | Host world units | Host physics loop |

Hinge values and motor targets use degrees. `addAsset` converts source units and
up axes to the world's Y-up frame. `position` and quaternion `rotation` set the
asset's world placement; defaults are the origin and identity. glTF attachment
replaces the asset root transform and restores it on disposal. Asset paths are
scoped per instance.

New shared assets participate immediately. `pause()` holds their pose while
keeping contacts and joints; `play()` resumes saved motion. `reset()` restores
the authored pose and holds it until `play()`. `isPlaying()` tracks explicit
playback controls and initially returns false.

Standalone `createSimulation()` supports `play()`/`update(dt)` playback and
manual `step(dt)`, even while paused. Shared assets advance through their world.
`step(dt)` advances exactly the supplied positive duration.

Borrowed worlds retain host settings and event ownership. Custom hosts compose
the adapter's `hooks` and call `sync()` after stepping. Dispose the adapter before
freeing the host world. Needle handles this registration automatically.

## Physics support

Joint frames, limits, drives, collision filters and mass properties are retained.
Fixed articulation links use reduced coordinates; movable links use impulse
constraints. SDF meshes use convex decomposition with concave compound contacts,
rather than PhysX SDF evaluation. Mimic joints follow their leader through a drive
that is updated after each step, so they lag slightly under load. `backend.adaptations`
describes conversions.

Unsupported features reject by default; `allowPartial: true` returns diagnostics.
Simulation and motor targets do not modify authored data. Custom async visual
bindings must check their abort signal after each await before accessing bodies.

## Development

`npm run build:types` checks the JavaScript and generates package declarations.
Commit the generated types with source changes; `prepack` rebuilds them.
Run `npm test` for the runtime and `npm run test:types` for packed TypeScript consumers.
