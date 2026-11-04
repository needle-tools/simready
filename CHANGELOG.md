# Changelog

## 0.1.0

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
