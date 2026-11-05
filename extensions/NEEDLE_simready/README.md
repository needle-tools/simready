# NEEDLE_simready

## Contributors

- Needle — [needle.tools](https://needle.tools), [hi@needle.tools](mailto:hi@needle.tools)

## Status

Draft.

## Dependencies

Written against **glTF 2.0**. Applicable to JSON glTF and GLB.

Optional companion extensions are described under
[Related extensions](#related-extensions). The [implementation notes](implementation.md) describe the USD exporter and the
Three.js, Needle Engine and Rapier adapters, including the glTF 2.1 draft.

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** have the
meanings defined by [BCP 14](https://www.rfc-editor.org/info/bcp14).

## Overview

`NEEDLE_simready` carries simulation data and source identities alongside ordinary
glTF geometry, materials and textures. It connects rendered nodes to rigid bodies,
retains collision geometry and joint constraints, and preserves typed semantic
properties that have no equivalent in the glTF visual model.

The extension separates three kinds of data:

- **Visuals:** ordinary glTF nodes, meshes, materials, cameras and lights.
- **Physics:** a glTF-coordinate snapshot of bodies, colliders, joints,
  materials, scenes, collision groups and articulations.
- **Semantics:** typed source properties, labels, relationships, applied schemas,
  profile metadata and other authored information.

A consumer can inspect the same asset, pose its joints, attach it to a simulator,
or use its labels in another application. Loading MUST NOT start simulation.
Physics results depend on the chosen solver; serializing a property does not
require every consumer to implement its behavior.

### When to include the extension

Producers MUST include the extension only when the asset carries SimReady or
physical data. Relevant data includes physics records, authored SimReady
metadata, semantic-label schemas and non-visual material properties. Ordinary
models without that data MUST NOT acquire an empty `NEEDLE_simready` payload.

An asset containing the extension MUST list `NEEDLE_simready` in
`extensionsUsed`. If bodies, colliders, joints or collision groups are part of
its intended behavior, it MUST also list it in `extensionsRequired`. A
metadata-only asset MAY omit it from `extensionsRequired`.

A visual-only application can use the ordinary glTF representation, but an
application which requires the asset's simulation behavior MUST NOT treat an
unsupported required extension as a complete simulation asset. The companion
physics extensions do not override this requirement.

## glTF schema updates

The extension adds one object at `/extensions/NEEDLE_simready`. It adds no
properties to nodes, materials or meshes.

| Property        | Type         | Required | Meaning                                                                              |
| --------------- | ------------ | -------- | ------------------------------------------------------------------------------------ |
| `version`       | integer      | Yes      | Extension version; MUST be `1`.                                                      |
| `stageNode`     | integer      | Yes      | Index into glTF `nodes`, identifying the asset-local reference root.                          |
| `snapshot`      | object       | Yes      | Physics data in glTF coordinates and SI units.                               |
| `bindings`      | object array | Yes      | Connections between glTF nodes and source identities.                                |
| `usdMetadata`   | object       | Yes      | Typed semantic data; empty `stage` and `prims` are valid.                            |
| `mappingIssues` | object array | No       | Descriptions of data without an exact companion-extension projection. Default: `[]`. |

Objects MAY include `extensions`, `extras` and additional members. 

Render geometry and textures use the ordinary glTF representation.

### JSON Schemas

- [Document extension](schema/glTF.NEEDLE_simready.schema.json)
- [Physics snapshot](schema/snapshot.schema.json)
- [Semantic metadata](schema/metadata.schema.json)
- [Common definitions](schema/common.schema.json)

The schemas use JSON Schema Draft 2020-12. Array-index bounds,
identity references and coordinate relationships also require the semantic
checks below. Passing JSON Schema validation alone is not sufficient.

## Physics snapshot

`snapshot` MUST contain `bodies`, `shapes`, `joints`, `scenes`, `materials` and
`groups` arrays, including when empty. `articulations` and `unsupported` are
optional. Entries in each record array, including `articulations`, MUST have
distinct, non-empty `path` identities.
Identities are opaque strings. USD exporters use composed absolute prim paths;
code-authored assets MAY use other stable identifiers.

`unsupported` records source extraction limitations as `{path, reason, type?}`.
The top-level `mappingIssues` uses the same structure for companion-projection
differences. Diagnostic paths MAY be empty for asset-wide issues and MAY repeat.

### Units and frames

The extension uses glTF's right-handed, Y-up coordinate system. Lengths are
metres, masses are kilograms, time is seconds and angles are radians.

| Value | Representation |
| --- | --- |
| Body `position`, `rotation` | Pose relative to the asset-local reference root. |
| Collider `position`, `rotation` | Pose relative to its owning body, or the reference root for a static collider. |
| Joint `position0/1`, `rotation0/1` | Attachment frame relative to the corresponding body, or the reference root for the fixed world. |
| Linear values and velocities | Metres and metres per second. |
| Angular limits, targets and velocities | Radians and radians per second. |
| Mass | Kilograms. |
| Density | Kilograms per cubic metre. |
| Inertia | Kilogram metres squared. |
| Force and torque | Newtons and newton metres, respectively. |
| Quaternion | `[x, y, z, w]`; finite, nonzero and normalized for use. |

`stageNode` identifies the asset-local reference root. Its ordinary glTF node
transform places the asset in the scene. Body poses, static colliders and fixed-world joint frames
share this root. Host placement and visual bindings MUST remain consistent
with it.

### Bodies

Each body has `path`, `position` and `rotation`. Optional fields describe
`scale`, `rigidBodyEnabled`, `kinematicBody`, `startsAsleep`, initial
`linearVelocity` and `angularVelocity`, `filteredCollisions` and
`simulationOwners`.

Mass properties are `mass`, `density`, `centerOfMass`, `diagonalInertia` and
`principalAxes`. They MAY also occur on colliders. Body-level authored mass
properties take precedence over inherited collider contributions. Missing or
`null` mass and density values leave their derivation to the consumer;
`null` MUST NOT be interpreted as zero mass.

`rigidBodyEnabled: false` retains a fixed body and its identity. It does not
remove its colliders or visuals. `kinematicBody` distinguishes host-controlled
motion from dynamic motion.

### Colliders

Each shape has `path` and `type`. Known types are `cube`, `sphere`, `capsule`,
`cylinder`, `cone`, `plane` and `mesh`. Other source types MAY be retained for
consumers which understand them. A consumer unable to simulate one MUST report
that limitation before claiming a complete simulation.

| Property                                                                 | Meaning                                                                            |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `body`                                                                   | Owning body identity. Missing or `""` means a static collider in the asset-local frame. |
| `position`, `rotation`                                                   | Local pose; defaults are the origin and identity quaternion.                       |
| `collisionEnabled`                                                       | Whether contact is enabled; default `true`. Disabled geometry is still retained.   |
| `halfExtents`                                                            | Box half sizes in metres.                                                    |
| `radius`, `halfHeight`, `axis`                                           | Analytic dimensions and longitudinal axis.                                         |
| `approximation`                                                          | Source collision interpretation, such as `none`, `convexHull` or `sdf`.            |
| `mesh`                                                                   | Index into glTF `meshes` for a mesh collider.                                      |
| `meshScale`                                                              | Scale applied to the decoded collision positions; default `[1,1,1]`.               |
| `materials`, `collisionGroups`, `filteredCollisions`, `simulationOwners` | Source identities and filtering/ownership information.                             |

For `type: "mesh"`, `mesh` is REQUIRED. Raw `points` or `indices` arrays MUST
NOT appear in the serialized shape. They are reconstructed from ordinary glTF
accessors. A collision mesh need not be attached to a rendered node.

`cube` requires nonnegative `halfExtents`; `sphere` requires `radius`;
`capsule`, `cylinder` and `cone` require `radius` and `halfHeight`. Radii and
half heights MUST be nonnegative. For a capsule, `halfHeight` excludes the
hemispherical end caps. `axis` defaults to `X` and identifies the longitudinal
axis, or the normal for a plane.

The referenced mesh supplies `POSITION` accessors and optional index accessors.
Their buffers follow ordinary glTF storage rules: external buffers or data URIs
in `.gltf`, or the binary chunk in `.glb`. No extension-specific binary sidecar
is needed. Visual and collision meshes MAY share accessors when their geometry
and local frames agree.

Collision positions MUST be recoverable in their collider-local frame, in metres.
A node transform used only by a visual instance MUST NOT implicitly alter those
positions. Mesh shapes can use triangle lists, strips or fans; convex-hull
inputs MAY use point primitives. A consumer MUST decode compression and
primitive topology before constructing collision triangles. Morph-target
collision meshes require an explicit supported conversion before use.

### Joints

Each joint has a `path` and source `type`. `body0` and `body1` identify its ends;
missing or empty identities refer to the fixed world. The joint frames default
to identity. `axis` selects `X`, `Y` or `Z`, with `X` as the default.

`jointEnabled` defaults to `true`; `collisionEnabled` and
`excludeFromArticulation` default to `false`. Disabled joints remain data.

- `limit`: `{enabled, lower, upper}`. A `null` lower bound means negative
  infinity; a `null` upper bound means positive infinity.
- `drive`: `{enabled, targetPosition, targetVelocity, stiffness, damping,
  acceleration?, forceLimit?}`. A missing or `null` force limit means unbounded.
  Angular targets use radians; linear targets use metres.
- `mimic`: `{joint, multiplier, offset}`. The joint coordinate is
  `multiplier * referencedCoordinate + offset`. The offset uses the dependent
  joint's units; the multiplier converts the referenced coordinate into those units.
  The referenced joint MUST exist. Cycles or inconsistent authored poses MUST
  be diagnosed by the controller.
- `minEnabled`, `maxEnabled`, `minDistance`, `maxDistance`: distance
  constraint settings in metres.
- `breakForce`, `breakTorque`: breaking thresholds in newtons and newton metres; missing or `null`
  means no finite authored threshold.

Drive stiffness multiplies position error and damping multiplies velocity
error. Their result is force for linear joints and torque for angular joints.
With `acceleration: true`, the result is linear or angular acceleration instead;
stiffness then uses inverse seconds squared and damping inverse seconds.

The format carries joint data independently of a solver's available joint
classes. Converting a joint into a different physical constraint MUST be
reported as an adaptation; silently discarding a limit, drive or coupling is
not a conforming complete simulation.

### Scenes, materials, groups and articulations

Scenes retain gravity direction in the asset-local frame and magnitude in metres
per second squared. Multiple physics scenes remain distinct;
a consumer MUST select the intended scene or otherwise resolve its ownership.

Physics materials retain static/dynamic friction, restitution and density.
Collision groups retain filtered-group identities, inversion and merged-group
membership. Filter paths can refer to source subtrees, rather than only to
individual exported body identities.

Articulations contain `path`, `rootPrims`, `filteredCollisions`,
`articulatedBodies` and `articulatedJoints`. `rootPrims` can identify an anchor
joint or a root body. An empty member in `articulatedBodies` denotes the fixed
world. `excludeFromArticulation` on a joint remains authoritative.
The topology does not mandate a particular simulator's solver representation.

## Visual bindings and instancing

Each binding contains:

| Property   | Required | Meaning                                                                                   |
| ---------- | -------- | ----------------------------------------------------------------------------------------- |
| `node`     | Yes      | Index into glTF `nodes`.                                                                  |
| `path`     | Yes      | Source prim or object identity.                                                           |
| `body`     | No       | Explicit owning body identity. If omitted or empty, a `path` matching a body identifies that body. |
| `instance` | No       | Opaque source-instance identity data.                                                     |

Binding node indices MUST be distinct and in range. A non-empty `body` MUST
resolve to a snapshot body. Several bindings MAY share a source `path`, as
instances can share a prototype. Their glTF nodes still have independent poses.
`instance` is not a glTF index namespace: source instancer indices and IDs MUST
NOT be remapped as node indices.

A bound visual keeps its initial offset relative to its owning body. Moving the
body MUST move all its bound visuals, including dependent handles or attachments.
An importer MUST NOT infer ownership solely from the visual node's parent or name.

## Semantic metadata

`usdMetadata` contains `{version: 1, time, stage, prims}`. `time` is the source
sample time, not a duration in seconds. `stage` is a dictionary of authored
stage metadata. Each prim contains `path` and `type`, and MAY include:

- `active: false` for an inactive prim; omission means active.
- `metadata`, including applied schemas and custom data.
- `attributes`: `{name, type, value, metadata?, connections?, default?, samples?}`.
  Each sample is `{time, value}`. `type` retains the source USD type name.
- `relationships`: `{name, targets, metadata?}`.
- `variants`: `{name, selection, choices}`.

Authored metadata retains its source types and values. It does not change the
coordinate system or units of the physics snapshot.

Paths, property names, namespace names, taxonomy identifiers and source asset
references are strings, not glTF indices. Namespaces MUST remain intact.
`omni:simready:nonvisual:*`, `semantics:labels:*`, vendor properties and
unknown schemas can coexist without changing the extension format.

Semantic values use JSON with reserved single-member objects for values JSON
cannot otherwise express:

| Representation                           | Meaning                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `{"$usdNumber":"Infinity"}`              | Positive infinity. `-Infinity` and `NaN` are also defined.             |
| `{"$usdInteger":"18446744073709551615"}` | Exact decimal integer, independent of JavaScript's safe-integer range. |
| `{"$usdValue":"..."}`                    | Source value text retained together with its declared USD type.        |

These tags also work in nested dictionaries, arrays and time samples. Their
reserved keys MUST NOT be repurposed. Ordinary numbers and small integers can
remain JSON numbers; typed buffers become arrays.

Static properties already represented by the snapshot SHOULD NOT be duplicated.
Source render meshes, material face lists and visual shader graphs SHOULD use
the glTF representation or a separate appearance extension. Semantic labels,
non-visual material properties and other nonvisual data MUST NOT be mistaken
for visual shader parameters merely because they share a material prim.

Variant choices and selections describe the composed configuration. They do
not embed alternate payloads, source layers or alternate geometry. Semantic
time samples do not implicitly create glTF animation channels.

## Related extensions

| Specification                                                                                                                                                                     | Role in a combined asset                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)                                                                                                             | Visual scene graph, geometry, materials, textures and animation.                           |
| [`KHR_physics_rigid_bodies`](https://github.com/KhronosGroup/glTF/pull/2424) — proposal                                                                                           | Portable body motion, collider attachments, physical materials and joint-frame projection. |
| [`KHR_implicit_shapes`](https://github.com/eoineoineoin/glTF_Physics/tree/9dc61cb3474ff9a51f58d3592f79d5c9e572056a/extensions/2.0/Khronos/KHR_implicit_shapes) — earlier proposal | Analytic collider geometry in the current glTF 2.0 export profile.                         |
| [glTF 2.1 shapes](https://github.com/KhronosGroup/glTF/tree/draft-2.1/specification/2.1) — draft                                                                                  | Reusable core shapes and bounding volumes; see the migration notes.                        |
| [`KHR_lights_punctual`](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_lights_punctual) and material/texture extensions                                | Visual appearance, independent of simulation metadata.                                     |

`NEEDLE_simready` does not require the optional physics projection to be present.

A consumer MUST select one physics representation for an asset. It MUST NOT
create a second set of bodies by independently instantiating both extensions.

## Optimization and reference integrity

Tools which rewrite an asset containing this extension MUST preserve:

- The frame and placement of `stageNode`.
- The identity and independent motion of bound nodes.
- Collision geometry, including meshes outside the rendered scene.
- Typed metadata, source identities and relationships.

A node reorder MUST update `stageNode` and `bindings[].node`. A mesh reorder
MUST update `snapshot.shapes[].mesh`. Companion-extension indices must also be
updated according to their own specifications. Strings containing USD paths or
source instancer indices MUST NOT be treated as glTF table indices.

Bound nodes MUST NOT be merged across independently moving bodies.

## Validation and consumer behavior

In addition to JSON Schema validation, a conforming reader checks that:

1. `stageNode`, binding nodes and collision meshes exist in the glTF document.
2. Binding nodes are unique and lie in the intended asset hierarchy.
3. Body owners, joint ends, mimic references, scene/material/group references
   and articulation members resolve in their appropriate identity namespaces.
4. Collision accessors decode to finite positions and valid primitive topology.
5. Body rotations are nonzero, physical dimensions are meaningful for the
   requested behavior, and the snapshot uses the fixed glTF unit conventions.
6. The selected simulator or mechanism supports the requested behaviors, or
   reports its unsupported features and adaptations.

Unknown versions and malformed references MUST be rejected before constructing
a controller. Reading metadata MUST NOT download or initialize a simulator.
A consumer MAY offer explicit partial operation with diagnostics, but MUST NOT
present it as complete support for the omitted behavior.

## Examples

- [Semantic labels](examples/semantic-labels.gltf) · [GLB](examples/semantic-labels.glb): labeled box and ball without physics bodies.
- [Hinged panel](examples/hinged-panel.gltf) · [GLB](examples/hinged-panel.glb): a movable panel with an attached handle, analytic colliders and a Khronos physics projection.
- [Mesh collider](examples/mesh-collider.gltf) · [GLB](examples/mesh-collider.glb): collision geometry referenced
  independently of the display mesh.

All examples are self-contained glTF assets. Their extension payloads are
schema-validated and loaded by the tests. The panel tests also pose the hinge
and verify that its visuals move.

The `.gltf` files embed their geometry buffers as data URIs. The matching `.glb`
files pack the same data into one binary file for loading in Baker or another
glTF application. Run `npm run examples:build` to regenerate them.

## Relationship to NVIDIA SimReady

[NVIDIA SimReady Foundation](https://nvidia.github.io/simready-foundation/latest/guides/getting_started.html) defines source capabilities and profiles on OpenUSD.

| Source capability                                            | Representation                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Units and core metadata                                      | Physics normalized to glTF units and authored metadata in `usdMetadata.stage`.                                                                                 |
| Bodies, collision shapes, mass, materials, joints and drives | Typed snapshot records and optional Khronos physics projection.                                                           |
| Semantic labels and taxonomy identifiers                     | Applied schemas and typed attributes in `usdMetadata.prims`.                                                              |
| Non-visual material attributes                               | Namespaced material properties and relationships in `usdMetadata.prims`.                                                  |
| Grasp, gripper, sensor and domain-specific properties        | Typed attributes, relationships and any separately represented geometry; a domain implementation supplies their behavior. |
| Runtime variants and profiles                                | Authored metadata and the selected composed configuration.                                                                |

Current adapter limitations and export-profile gaps are listed in the
[implementation notes](implementation.md#current-gaps), rather than changing
the meaning of the wire format for a particular solver.

## Known implementations

- [Needle SimReady](https://github.com/needle-tools/simready): Three.js loader,
  joint posing, standalone/shared Rapier simulation and Needle Engine integration.
- [Needle USD](https://github.com/needle-tools/usd-viewer/tree/main/usd-wasm):
  composed-USD export and USD runtime adapters.

Copyright Needle Tools. This specification, schemas and examples are distributed
under the [MIT license](../../LICENSE.txt).
