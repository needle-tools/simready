# Implementation and interoperability

This document describes the current implementations of
[`NEEDLE_simready`](README.md). The extension's data model is independent of
these exporter and solver choices.

## USD export profile

[Needle USD](https://github.com/needle-tools/usd-viewer/tree/main/usd-wasm)
exports the composed configuration at the selected time. Rendered instances
become independently bound glTF nodes, with their source identities retained.
Original or preview textures can be selected without changing the viewed asset.

Authored SimReady metadata and USD physics data enable the extension. Ordinary
models export as ordinary glTF. Geometry follows the selected visibility and
purpose configuration; schema metadata alone does not include the geometry of
an excluded guide or grasp curve.

The exporter converts source length and mass units, up axis and angular values
into glTF's right-handed, Y-up, metre/kilogram/second/radian conventions before
writing physics. This includes local collider and joint frames, collision
positions, mass properties, velocities, limits, drives and mimic relationships.
The source snapshot remains unchanged. The optional Khronos projection uses
the same normalized geometry and physical values.

The generic USD/native `PhysicsSnapshot` API retains source units and degrees.
The glTF loader adapts the fixed-unit wire data to that API using metres,
kilograms and Y up, converting angular values to degrees at the runtime
boundary. Existing joint-control methods therefore take degrees for angular
joints and metres for linear joints loaded from glTF.

| Source data | glTF 2.0 projection |
| --- | --- |
| Body motion, mass, inertia and initial velocity | `KHR_physics_rigid_bodies` motion on the corresponding body node. |
| Analytic collider | `KHR_implicit_shapes` definition referenced by a collider node. |
| Triangle mesh or convex hull | Ordinary collision mesh referenced by the collider. |
| Fixed, revolute, prismatic or unlimited spherical joint | Two attachment nodes and a Khronos joint definition, with representable limits and drives. |
| Other source semantics | `NEEDLE_simready` snapshot and typed metadata; projection differences appear in `mappingIssues`. |

The implemented proposal reference is
[`glTF_Physics` at `9dc61cb3474ff9a51f58d3592f79d5c9e572056a`](https://github.com/eoineoineoin/glTF_Physics/tree/9dc61cb3474ff9a51f58d3592f79d5c9e572056a/extensions/2.0/Khronos).
This is an explicit compatibility target, not a claim of conformance to every
subsequent physics draft. The current Khronos registry lists
[`KHR_physics_rigid_bodies`](https://github.com/KhronosGroup/glTF/pull/2424)
and [`KHR_collision_shapes`](https://github.com/KhronosGroup/glTF/pull/2370)
as proposals under development. The earlier implicit-shape proposal and the
new core-shape work must not be confused with ratified glTF 2.0 features.

## glTF 2.1 shapes

The Khronos [`draft-2.1`](https://github.com/KhronosGroup/glTF/tree/draft-2.1/specification/2.1)
contains core shape and bounding-volume definitions. The
[shapes explainer](https://github.com/KhronosGroup/glTF/issues/2588) describes
the promotion of the earlier `KHR_implicit_shapes` work. The
[shape schema](https://github.com/KhronosGroup/glTF/blob/draft-2.1/specification/2.1/schema/shape.schema.json)
also defines mesh and convex-mesh shape resources.

These findings are based on draft revision
[`ba4e9e26dbd5c999a4f9680b2028425e3133dacc`](https://github.com/KhronosGroup/glTF/tree/ba4e9e26dbd5c999a4f9680b2028425e3133dacc/specification/2.1).
A draft revision is not a released compatibility guarantee.

| Existing collider | Candidate glTF 2.1 shape |
| --- | --- |
| `cube` | `box` with twice the half extents. |
| `sphere` | `sphere` with the radius. |
| `capsule` | `capsule` with the height and end radii. |
| `cylinder` / `cone` | `cylinder`; a cone has one zero end radius. |
| `plane` | `plane`, with its authored orientation supplied by the attachment. |
| Triangle mesh | `mesh` referring to ordinary glTF mesh geometry. |
| Triangulated convex hull | `convexMesh` referring to its hull mesh. A raw convex point set first needs a hull conversion. |

A future 2.1 export profile can place these resources in the core `shapes`
array and use core shape references in the appropriate attachment format.
The existing `snapshot.shapes[].mesh` remains a **glTF mesh index**; it must not
be reinterpreted as a core shape index. Shape resources do not by themselves
create bodies, collision responses, joints or sensor behavior. Bounding volumes
are also not automatically physics colliders.

The practical path is to reuse these shape definitions and conversion rules,
while retaining the glTF 2.0 export profile for current consumers. A 2.1 writer
needs the completed attachment semantics, matching importer/optimizer support,
and version/minimum-version handling. Changing the default file version now
would add compatibility risk without improving the extension's retained data.

## SimReady Foundation capabilities

NVIDIA's [SimReady Foundation](https://nvidia.github.io/simready-foundation/latest/guides/getting_started.html)
organizes OpenUSD requirements into capabilities, features and profiles.
The extension carries their data and identities; it does not run the Foundation
validation rules or certify a profile.

Physics is represented by the typed snapshot. Labels, taxonomy identifiers,
non-visual material attributes and vendor settings remain named, typed semantic
properties. Runtime-specific PhysX, Newton or MuJoCo variant selections are
recorded with the composed configuration. Grasp and gripper properties can be
read by an application without binding them to a particular physics engine.

Applications which need a sensor renderer, robotics controller or Foundation
conformance report supply those domain implementations. Preserving the inputs
and running their algorithms are separate capabilities.

## Current gaps

| Area | What remains |
| --- | --- |
| Contact solver features | The Rapier adapter reports unsupported D6/general joints, spherical cone limits, breaking thresholds, minimum/bounded distance configurations and dynamic mimic coupling. Joint posing supports authored mimic coupling for its supported joint kinds. |
| Exact solver equivalence | SDF meshes use convex decomposition; fixed articulation links can use reduced coordinates while moving links use impulse constraints. These adaptations are reported. They do not reproduce another simulator's numerical trajectory exactly. |
| Source configuration and animation | The USD export profile stores the selected composition and source samples, not alternate payload packages or baked animation clips. Its visual conversion currently requires rigid geometry; active animated kinematic driving needs a host implementation. |
| Domain execution and appearance | Sensor/ROS/robotics algorithms are application responsibilities. Visual MaterialX/MDL graphs use exposed PBR properties and textures in this export profile, rather than an arbitrary shader-graph bake. Non-visual material properties remain semantic data. |
| Khronos draft interoperability | The optional physics projection targets the pinned proposal above. A core-shape glTF 2.1 projection and later physics-draft changes need their own compatibility tests before becoming the default. |

These are implementation boundaries, not missing containers in the extension.
The wire format retains source joint types, thresholds, couplings, vendor
properties and diagnostics so consumers can implement additional behavior.
A consumer must report a limitation before claiming complete operation.

## Validation

Run `npm test` to check schemas, examples and runtime behavior. The schema tests
validate the checked-in examples and payloads produced by the extension writer,
and reject malformed versions, references, vectors and tagged values.

The USD package also validates native USD → GLB → runtime round trips and
compatible optimizer output. Their workflow is documented in
[USD export guide](../../docs/usd-export.md).
