# USD coupling and articulation export

The browser/Worker-safe `@needle-tools/simready/usd` entry authors the official
PhysX USD mimic schema. Core UsdPhysics alone has no scalar joint-coupling schema.
This export is not a claim of NVIDIA SimReady Foundation profile conformance.

```js
import {prepareUsdPhysicsSnapshot, encodeUsdJointMetadata} from '@needle-tools/simready/usd';
const exported = prepareUsdPhysicsSnapshot(sourceSnapshot);
for (const joint of exported.joints) {
    const metadata = encodeUsdJointMetadata(joint, path => exportedPaths.get(path));
    // Apply metadata.apiSchemas. Write typed attributes and relationships as
    // schema properties, without the USD `custom` qualifier.
}
```

`metadata.attributes` contains `{name,type,value}` records and
`metadata.relationships` contains `{name,targets}` records. The follower receives
`PhysxMimicJointAPI:rotX`, `physxMimicJoint:rotX:referenceJoint`, float `gearing` and
`offset`, and uniform-token `referenceJointAxis`. The canonical `rotX` instance
also applies to prismatic joints: for single-DOF joints it identifies the implicit
DOF, not the geometric axis. Do not substitute `transX` or `linear`.

The native equation is `follower + gearing * reference + offset = 0`. Our snapshot
uses `follower = multiplier * reference + offset`, so both coefficients change
sign. Values retain source stage distance units and degrees. Mixed gearing is
stage-distance/degrees or degrees/stage-distance; the writer must not apply the
radians conversion used internally by a physics engine. Natural frequency and
damping ratio are both authored as `-1`, the PhysX noncompliant constraint setting.
Native coupling is a two-way constraint; the Rapier adapter approximates coupling
with a follower servo, so their responses to load are not identical.

The planner returns a detached snapshot. It preserves existing frames, geometry,
limits, coefficients and authored drives. Unbounded mimic/reference joints receive
explicit `-inf`/`inf` limit opinions instead of fabricated finite travel. A native
mimic combined with an independently authored drive can exert additional forces;
Foundation driven-joint checks may reject nonzero follower gains. The planner does
not silently remove those forces to satisfy a profile.

For grounded components needed by a coupling, the planner adds an identity rigid
body (`usdSyntheticBase: true`) and a world fixed joint (`articulationRoot: true`).
World endpoints become endpoints on that base with identical local frames. The
base is enabled and nonkinematic; its explicit unit mass and diagonal inertia are
solver placeholders on a completely fixed root, not measurements of visible asset
material. Exclude this generated base from physical product mass accounting.

All required mimic/reference edges enter the articulation spanning tree first.
Other cycle edges are retained with `excludeFromArticulation: true`, preserving
closure constraints outside the reduced-coordinate tree. The `articulations`
records list selected tree joints and bodies. A connected floating assembly keeps
its floating root (`articulationRoot: true` on a body) and receives no fixed base.
Writers must emit `PhysicsArticulationRootAPI` on marked joints/bodies and
`physics:excludeFromArticulation` on excluded joints, and export generated bodies
and joints even though they have no associated visual object.

The planner rejects dependency cycles, zero gearing, missing references, mandatory
joint cycles, disconnected floating couplings, disabled or unsupported joints,
kinematic/disabled links, conflicting simulation owners, and existing articulation
membership needing an explicit merge policy. It never converts an animated
kinematic mounting body into a fixed world attachment. Unrelated components stay
unchanged. Inputs without mimic only receive a detached copy.

```js
import {decodeUsdJointMetadata} from '@needle-tools/simready/usd';
const mimic = decodeUsdJointMetadata(attributeValuesByName, relationshipTargetsByName);
if (mimic) joint.mimic = mimic;
```

The reader prefers official `rotX`/`rotY`/`rotZ` mimic fields and retains legacy
`simready:mimic*` and `simready:coupled*` compatibility. Multiple mimic axes cannot
be reduced to one scalar record and reject. A matching USD reader still supplies
native bodies, frames, limits and geometry.

Validate schema types and relationships with registered PhysX USD schemas. For
Foundation conformance, separately pin the Foundation release and profile, run its
official validator, inspect the relevant optional feature results, and run runtime
benchmarks. Profile requirements include more than this coupling representation;
some validator releases also have limit checks that disagree with valid offset
couplings. Do not change mechanical travel merely to make such a check pass.

References: [PhysX mimic schema](https://docs.omniverse.nvidia.com/kit/docs/omni_usd_schema_physics/latest/physxschema/class_physx_schema_physx_mimic_joint_a_p_i.html),
[articulation topology](https://docs.omniverse.nvidia.com/kit/docs/omni_physics/108.0/dev_guide/rigid_bodies_articulations/articulations.html),
[PhysX compliance](https://nvidia-omniverse.github.io/PhysX/physx/5.7.0/docs/Articulations.html),
[prismatic instance-token clarification](https://github.com/isaac-sim/IsaacSim/issues/731),
[Foundation validation](https://pypi.org/project/simready-validate/).
