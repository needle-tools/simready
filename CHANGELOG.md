# Changelog

## Unreleased

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
