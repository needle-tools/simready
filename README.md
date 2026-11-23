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

The [USD coupling codec and articulation planner](docs/usd-metadata.md) author official
PhysX mimic schemas and explicit articulation topology without a USD runtime dependency.

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

For SimReady assets, the loader bounds concurrent image reads so large embedded
atlases do not exhaust the browser's Blob memory quota. Image failures retain
Three.js's normal error reporting.

For joint posing, create a mechanism once:

```js
const mechanism = await runtime.createMechanism();
mechanism.setJointValue('/Assembly/Hinge', 45);
```

Loading preserves the resting pose and starts no solver. Kinematics loads on demand and handles limits, fixed attachments, mimic relationships and closed linkages. Hinge controls use degrees; slider controls use metres.

During manipulation, fixed attachments retain their authored rest offset. Inconsistent fixed-joint frames produce a warning without blocking valid movable joints. Dynamics continues to use the authored constraint frames.

Use the joint paths stored in your asset; `/Assembly/Hinge` and `/Assembly/Slide`
are examples. `runtime.snapshot` contains the bodies, colliders and joints in glTF metres and radians, and
`runtime.semantics` contains defined semantic labels attached to exported identities.
The interchange contract contains converted physics, visual bindings and semantic labels.

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

Body snapshots accept nonnegative `linearDamping` and `angularDamping` rates in
inverse seconds. Explicit zero means no damping. During a physics drag, the
grabbed body receives extra damping so off-centre grabs settle; releasing restores
its configured rates and retains its current velocity.

SDF-source collision meshes use convex decomposition. A small contact skin
(up to 0.5 mm, capped at 1% of the mesh extent) stabilizes thin features without
changing render geometry or mass. Decomposed shapes retain their face normals
rather than clamping them across internal cuts, which can miss thin curved contacts.

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

## Dragging articulated parts

Enable point dragging to pose an open chain by grabbing its surface. Picking a lamp shade can move both the shoulder and the elbow. Lighter joints move first, weighted by the mass each one carries from `computeMassProperties`. The pointer always wins while dragging; a driven joint you move keeps its new value as its drive target (see [kinematic posing](docs/kinematic-posing.md)). Hinges, drawers, mimic joints and closed linkages retain their joint constraints. The default `dragMode` is `'joint'` for applications that drive one coordinate at a time.

```js
import {bindPointerDrag} from '@needle-tools/simready/three';

const mechanism = await runtime.createMechanism({dragMode: 'point'});
mechanism.play();
let hovering = false, dragging = false;
const updateCursor = () => {
  renderer.domElement.style.cursor = dragging ? 'grabbing' : hovering ? 'grab' : '';
};
const pointer = bindPointerDrag({
  element: renderer.domElement,
  camera,
  root: mechanism.root,
  controller: mechanism,
  onMove: requestRender, // for on-demand rendering
  // The binding never changes cursors or styles; the host decides how to show them.
  onHoverChange: path => { hovering = !!path; updateCursor(); },
  onDraggingChange: active => { dragging = active; updateCursor(); },
});

// When unloading this viewer or replacing its controller:
pointer.dispose();
mechanism.dispose();
```

`onHoverChange` reports the part an idle pointer would grab, or `null`, at most once per animation frame and only when it changes. It reports only parts the controller's `canDrag(path)` accepts: a moving joint for mechanisms, a dynamic body for simulations, and only while playing. Nothing is offered while a button is held for camera navigation. During a gesture the grabbed part stays hovered; an interrupted gesture clears it.

The adapter raycasts the nearest visible surface and respects instance bindings. Accepted grabs follow a camera-facing plane through the hit. A hinge seen nearly edge-on rolls with the pointer's travel across its axis; others follow the pointer around the axis. Misses, stationary foreground parts and modified clicks remain available to camera controls. Hosts with their own picking can supply `pick(event, raycaster, controller)` and return a body path and world-space hit point. Call `pointer.cancel()` before replacing a live controller. For XR input, send the tracked point in mechanism-local coordinates directly to `beginDrag`, `moveDrag` and `endDrag`.

The kinematics solver installs by default as an optional npm dependency and loads when a mechanism is created. Consumers that only use the data APIs can omit optional dependencies.

## Controller lifetime

A mechanism stays alive across joint changes and drag gestures. Use
`setJointValue()` repeatedly, or `beginDrag()`, `moveDrag()` and `endDrag()` for
pointer interaction. `endDrag()` finishes a gesture without destroying the
mechanism. `play()` enables dragging; `pause()` stops dragging while keeping the
controller available.

Joints with authored drives move toward their drive targets when nothing holds them.
Call `mechanism.update(dt)` once per frame with the elapsed seconds; it returns
whether a joint moved. Each drive acts as a spring and damper on its own joint,
moving the inertia that joint carries, within its force limit and with the body's
authored damping or 0.05 per second for hinges. This is not a physics simulation:
there is no gravity, no contact and no dynamic coupling between joints.

Posing is deliberate. When a drag or `setJointValue()` moves a driven joint, that value
becomes its drive target, so the pose holds instead of springing back. Joints you did not
move keep their authored targets, and `reset()` restores all of them. The snapshot is not
changed. [Kinematic posing](docs/kinematic-posing.md) explains the choice and how it
relates to physics dragging.

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

Hinge values and motor targets use degrees. Dynamics reports accumulated hinge
turns, including travel beyond 360 degrees. Each hinge must rotate by less than
180 degrees between physics samples; choose the physics timestep accordingly.
Borrowed hosts must call the adapter after every physics step so turns are not
lost. Angular hard stops that cross the principal-angle seam require a Rapier
adapter with joint local-frame setters (available in Rapier 0.21; absent in
0.19.3). Backends without these setters reject those assets by default;
`allowPartial: true` returns an unsupported-feature diagnostic.

`addAsset` converts source units and
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
`computeMassProperties(snapshot)` returns each body's mass, center of mass and principal
inertia in the snapshot's units, without loading Rapier. An authored body mass wins;
otherwise collider masses add up, each from its authored mass or its volume times the
collider's, body's or material's density, else 1000 kg/m³. Authored centers of mass and
inertia override derived ones.
Fixed articulation links use reduced coordinates; movable links use impulse
constraints. SDF meshes use convex decomposition with concave compound contacts,
rather than PhysX SDF evaluation. Rapier also uses convex compounds for moving
triangle meshes when the supplied backend supports compound cooking; static and
kinematic triangle meshes retain their authored surfaces. Mimic joints follow their leader through a drive
that is updated after each step, so they lag slightly under load. `backend.adaptations`
describes conversions.

Unsupported features reject by default; `allowPartial: true` returns diagnostics.
Simulation and motor targets do not modify authored data. Custom async visual
bindings must check their abort signal after each await before accessing bodies.

## Development

`npm run build:types` checks the JavaScript and generates package declarations.
Commit the generated types with source changes; `prepack` rebuilds them.
Run `npm test` for the runtime and `npm run test:types` for packed TypeScript consumers.
