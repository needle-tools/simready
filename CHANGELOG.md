# Changelog

## Unreleased

- Roll a hinge seen edge-on with the pointer instead of flipping its angle where the pointer crosses the axis. `bindPointerDrag` passes the drag plane's normal to `beginDrag(path, point, {normal})`; callers without one keep the previous mapping.
- Move joints with authored drives toward their drive targets in kinematic mode through `mechanism.update(dt)`, within each drive's force limit. A driven joint you pose by dragging or with `setJointValue()` keeps that pose as its drive target until `reset()`.
- Point dragging moves lighter joints first, by the mass each joint carries. This uses the Needle fork of closed-chain-ik; with upstream closed-chain-ik, point dragging keeps its previous behavior.
- Drag casters and other joint chains past their reach without the pose jumping between nearly equal solutions.
- Compute each body's mass, center of mass and principal inertia from its colliders and authored values with `computeMassProperties(snapshot)`, following USD's precedence. Rapier interaction mode uses these masses instead of a unit mass.

- Report the draggable part under an idle pointer through `bindPointerDrag({onHoverChange})`, and add `canDrag(path)` to mechanisms and simulations. **Breaking:** the binding no longer sets the element's cursor while dragging; hosts style cursors from `onHoverChange` and `onDraggingChange`.

- Share schema validation between the reader and writer for runtime physics and semantic labels.

- Preserve compound trigger membership during node reordering and write mesh collider references in the Khronos glTF physics draft format.

- Preserve authored full-revolution joint references through manipulation, simulation and the glTF runtime descriptor.
- Remove the glTF Transform adapter entry point from the runtime package.

- Keep world-to-world joints in the runtime snapshot without creating a redundant constraint on the physics world's fixed body.

- Cook convex-decomposition collision meshes independently of their local origin and coordinate scale, preserving their original size and mass frame.
- Repair invalid convex-decomposition faces from the original hull vertices so thin collision parts remain usable without dropping shapes or filling cavities.
- Retain two-point decomposition hulls as exact zero-thickness segments rather than rejecting the entire compound.
- Use convex compounds for dynamic triangle meshes in Rapier, retaining concavity, collision settings and authored mass properties. Static surfaces retain their triangle meshes; snapshots and exported collision geometry remain unchanged.

- Preserve per-body gravity and explicit continuous-collision choices in snapshots and both physics adapters.

- Manipulate spherical joints with quaternion controls and pointer dragging, including swing limits and reversed attachments.
- Preserve authored rest poses for inconsistent joint frames while keeping hard travel limits. Report these visual-binding adaptations separately; strict frame validation remains available.

- Simulate authored convex-decomposition meshes as concave compounds, preserving cavities and contact geometry.
- Treat PhysX maximum-float joint breaking thresholds as unbounded, including glTF unit conversion; finite thresholds still require backend breakage support.

- Preserve mechanical clearances in large SDF-source collision meshes without increasing the cooking grid for small parts.
- Keep valid hinges and sliders usable when a fixed attachment has inconsistent frames; manipulation preserves the attachment's authored rest offset and reports the mismatch.
- Improve contacts between thin SDF-source collision meshes without changing their geometry or mass.
- Preserve body damping in snapshots and both physics adapters. Pointer grabs damp sideways motion and no longer inject cursor-jump velocities; release restores the body's damping and retains its momentum.
- Create Needle Engine dynamics with Engine's `physics.createAsset`. SimReady describes shapes, mass properties, joints, drives, articulations and collision filters; Engine creates the physics objects and their components. Requires a Needle Engine version with `physics.createAsset`.
- Key Needle collider components by collider path. Needle asset bodies expose pose and velocity methods instead of raw Rapier bodies, and `world.capabilities` reports backend support.
- Share snapshot interpretation and playback controls between the standalone Rapier and Needle adapters.
- Simulate mimic joints: the follower is driven toward the leader's position after each step. Assets with mimic joints no longer count as unsupported.
- Pass joint break thresholds and spherical cone limits to backends that support them.

## 0.1.0

- Specify the NEEDLE_simready glTF extension with JSON Schemas, examples and interoperability guidance.

- Match TypeScript descriptors to runtime defaults and retain native Rapier types when creating simulations from glTF.
- Load SimReady glTF assets in Three.js and Needle Engine.
- Run standalone or shared-world Rapier simulation in browsers and Node.js, including interaction with other Needle physics objects.
- Use the same joint controls and simulation with USD, glTF and code-created assets.
- Simulate independently loaded assets together, with correct units and independent instances.
- Support concave collision meshes, including SDF-authored meshes, while preserving cavities and collider mass properties.
- Improve articulated assembly stability while preserving joint limits, drives and collision filtering.
- Pause individual assets while others keep moving, retaining contacts and joints; resume their saved motion.
- Keep object and instance picking accurate for fixed, kinematic and paused parts.
- Display joint helpers and control motor targets without changing asset data.
