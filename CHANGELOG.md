# Changelog

## Runtime interchange correction

- Write version 3 runtime physics and semantic labels without source USD property bags or numeric authoring archives.
- Use one runtime descriptor for reading and writing, with shared schema validation.

## Unreleased

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
