# @needle-tools/simready

Load articulated glTF assets, manipulate joints, and simulate independently loaded assets in a shared world. The runtime also accepts physics descriptors from USD or code. It runs in browsers and Node.

```sh
npm install @needle-tools/simready three
```

## Three.js

Register the extension on your `GLTFLoader` before loading a SimReady GLB. In an
existing Three.js application, `scene` below is your render scene:

```js
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {registerSimreadyLoader, getSimreadyRuntime} from '@needle-tools/simready/gltf';

const asset = await registerSimreadyLoader(new GLTFLoader()).loadAsync('/assembly.glb');
scene.add(asset.scene);
const runtime = getSimreadyRuntime(asset);
if (!runtime) throw new Error('This asset has no SimReady data.');
const mechanism = await runtime.createMechanism();
mechanism.setJointValue('/Assembly/Hinge', 45);
```

Loading preserves the resting pose and starts no solver. Kinematics loads on demand and handles limits, fixed attachments, mimic relationships and closed linkages. Hinge values are degrees; slider values use the asset's stage units.

Use the joint paths stored in your asset; `/Assembly/Hinge` and `/Assembly/Slide`
are examples. `runtime.snapshot` contains the bodies, colliders and joints, and
`runtime.usdMetadata` contains the retained schema metadata.

For dynamics without an existing physics host, install Rapier:

```sh
npm install @dimforge/rapier3d-compat
```

Initialize it once, then attach assets to one world. Continue from the previous
example after disposing the mechanism:

```js
import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '@needle-tools/simready/rapier';

await R.init();
mechanism.dispose();
const world = createSimulationWorld({rapier: R});
const assembly = await runtime.createSimulation({world, id: 'assembly'});

// Advance the shared world from your fixed-step loop.
world.step(1 / 120);
assembly.setJointTarget('/Assembly/Slide', {position: .3});
```

Meshes update when the world steps. Attach additional assets with their own IDs
to get contacts between them. `assembly.dispose()` removes that asset;
`world.dispose()` removes all of this world's assets. The application still owns
the Three.js scene, geometries, materials and textures.

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
if (!asset) throw new Error('The glTF asset did not load.');
context.scene.add(asset.scene);
const runtime = getSimreadyRuntime(asset);
if (!runtime) throw new Error('This asset has no SimReady data.');
const mechanism = await runtime.createMechanism();
mechanism.setJointValue('/Assembly/Hinge', 45);
```

This preserves Needle's other glTF import plugins and keeps SimReady registration
separate from the USD plugin. Loading an asset or creating a mechanism does not
initialize Rapier. Dispose the mechanism before switching to dynamics.
When removing the application's loader registration, call
`removeCustomImportExtensionType(simreadyPlugin)` from `@needle-tools/engine`.

For dynamics, reuse the Engine's Rapier module and world. This requires an Engine
version with `RapierPhysics.registerWorldExtension`. The same setup works when
physics is already running and when the Engine has not initialized it yet:

```js
import {NEEDLE_ENGINE_MODULES} from '@needle-tools/engine';
import {createSimulationWorld} from '@needle-tools/simready/rapier';

const physics = context.physics.getOrCreatePhysicsEngine();
if (!physics?.registerWorldExtension) {
  throw new Error('This host needs a Rapier backend with world extension support.');
}
const registerWorldExtension = physics.registerWorldExtension.bind(physics);
if (!await physics.initialize() || !physics.world) throw new Error('Host physics is disabled.');
mechanism.dispose();
const world = createSimulationWorld({
  rapier: NEEDLE_ENGINE_MODULES.RAPIER_PHYSICS.MODULE,
  world: physics.world,
  registerWorldExtension,
});
const assembly = await runtime.createSimulation({world, id: 'assembly', position: [0, 0, 0], rotation: [0, 0, 0, 1]});
```

Needle steps the world and synchronizes the asset through its normal physics
loop. Do not call `world.step()` or `assembly.update()` to advance this borrowed
world. Keep the adapter on your owning component and call `world.dispose()` from
its `onDestroy()`; this removes the imported bodies without freeing Needle's
world or removing other components' bodies. Engine world teardown also disposes
registered adapters before freeing the solver.

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
if (!asset) throw new Error('The USD asset did not load.');
context.scene.add(asset.scene);
const handle = getHydraHandleFromNeedleEngineAsset(asset);
if (!handle) throw new Error('The loaded asset has no USD handle.');

const mechanism = await createUsdMechanism({handle});
mechanism.setJointValue('/Cabinet/Hinge', 45);
```

Dispose the mechanism before switching to dynamics. With the Engine world
adapter from the previous example, attach the USD handle instead of a glTF
runtime:

```js
import {createUsdPhysics} from '@needle-tools/usd/physics';

mechanism.dispose();
const cabinet = await createUsdPhysics({handle, world, id: 'cabinet', allowPartial: false});
```

The USD adapters read the composed stage, bind bodies to rendered instances and
pause timeline playback while they control the poses. They use this package's
controllers. Dispose them before unloading or recomposing the stage, and call
`removeUsdPlugin()` when removing the application's USD loader registration.

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

## Coordinates and lifetime

When another host already has a Rapier world, borrow that exact world and its
module. The adapter adds and removes only its own bodies; it preserves gravity,
solver settings and the host's event queue. It cannot step a borrowed world.

Other hosts can pass `world` without a registration callback, compose `world.hooks` with their existing contact filters, and call `world.sync()` after their own physics step. They must call the adapter's `dispose()` before freeing the borrowed Rapier world. Registration automates that lifecycle; it never replaces or patches the host's methods. Custom asynchronous `bindVisuals(bodies, warn, signal)` callbacks must call `signal.throwIfAborted()` after each await before accessing a physics body; disposal aborts pending bindings before releasing the bodies.

`addAsset` converts stage units and up axes into the world's Y-up coordinates. World units default to metres and kilograms. Placement uses explicit `position` and quaternion `rotation` in world coordinates, defaulting to the world origin and identity. Supply the intended placement when attaching an already positioned render asset; attachment replaces its root transform until disposal. Each asset retains its own path namespace, so repeated imports can share original body and joint paths. The glTF integration places render geometry into the same frame and restores it when detached. The host owns the surrounding scene and its resources.

Mechanism sliders use source stage units. In a shared simulation, slider values
and motor targets use world units; hinge values remain degrees.

`step(dt)` advances exactly the requested positive duration, independent of playback. For an individual stage-coordinate simulation, `createSimulation({snapshot, rapier})` also provides the legacy playback accumulator through `play`, `pause` and `update`. Use the owning world's `step` for shared assets. Reset and disposal affect only the corresponding asset.

Simulation never writes authored data. Motor targets are transient controls; `reset` restores authored settings. Kinematic posing and force-driven simulation are separate controllers. Dynamics rejects unsupported features by default and returns diagnostics when `allowPartial: true` is explicitly requested. USD's published compatibility wrappers retain their previous defaults.

The data entrypoint exports `createSimreadyExtension`, `encodeMetadata` and `validateSnapshot` without importing Three or a solver. `/three` supplies explicit object/instance bindings and joint helpers; `/gltf` provides the opt-in loader; `/kinematics` and `/rapier` provide controllers. USD extraction and USD-to-glTF conversion remain in `@needle-tools/usd`.

The versioned `NEEDLE_simready` contract retains resolved physics and semantic metadata. It describes the composed configuration; USD layers and alternate variant contents remain part of the source document. Render geometry and collision meshes use ordinary glTF storage.
