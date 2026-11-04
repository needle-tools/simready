# @needle-tools/simready

Load articulated glTF assets, manipulate joints, and simulate independently loaded assets in a shared world. The runtime also accepts physics descriptors from USD or code. It runs in browsers and Node.

```sh
npm install @needle-tools/simready three
```

Register the glTF extension explicitly:

```js
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {registerSimreadyLoader, getSimreadyRuntime} from '@needle-tools/simready/gltf';

const asset = await registerSimreadyLoader(new GLTFLoader()).loadAsync('/assembly.glb');
scene.add(asset.scene);
const runtime = getSimreadyRuntime(asset);
const mechanism = await runtime.createMechanism();
mechanism.setJointValue('/Assembly/Hinge', 45);
// Dispose before switching from posing to dynamics.
mechanism.dispose();
```

Loading preserves the resting pose and starts no solver. Kinematics loads on demand and handles limits, fixed attachments, mimic relationships and closed linkages. Hinge values are degrees; slider values use the asset's stage units.

For dynamics, install and initialize Rapier in the application. One world owns stepping, gravity and contacts between all its assets:

```js
import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '@needle-tools/simready/rapier';

await R.init();
const world = createSimulationWorld({rapier: R});
const assembly = await runtime.createSimulation({world, id: 'assembly'});
const prop = await world.addAsset({id: 'prop', snapshot: propPhysics});

// Call from the application's fixed-step loop, or from a headless script.
world.step(1 / 120);
assembly.setJointTarget('/Assembly/Slide', {position: .3});
world.removeAsset('prop');
world.dispose();
```

`addAsset` converts stage units and up axes into the world's Y-up coordinates. World units default to metres and kilograms. Placement uses `position` and quaternion `rotation` in world coordinates. Each asset retains its own path namespace, so repeated imports can share original body and joint paths. The glTF integration places render geometry into the same frame and restores it when detached. The host owns the surrounding scene and its resources.

`step(dt)` advances exactly the requested positive duration, independent of playback. For an individual stage-coordinate simulation, `createSimulation({snapshot, rapier})` also provides the legacy playback accumulator through `play`, `pause` and `update`. Use the owning world's `step` for shared assets. Reset and disposal affect only the corresponding asset.

Simulation never writes authored data. Motor targets are transient controls; `reset` restores authored settings. Kinematic posing and force-driven simulation are separate controllers. Dynamics rejects unsupported features by default and returns diagnostics when `allowPartial: true` is explicitly requested. USD's published compatibility wrappers retain their previous defaults.

The data entrypoint exports `createSimreadyExtension`, `encodeMetadata` and `validateSnapshot` without importing Three or a solver. `/three` supplies explicit object/instance bindings and joint helpers; `/gltf` provides the opt-in loader; `/kinematics` and `/rapier` provide controllers. USD extraction and USD-to-glTF conversion remain in `@needle-tools/usd`.

The versioned `NEEDLE_simready` contract retains resolved physics and semantic metadata. It describes the composed configuration; USD layers and alternate variant contents remain part of the source document. Render geometry and collision meshes use ordinary glTF storage.
