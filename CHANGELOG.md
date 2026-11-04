# Changelog

## 0.1.0

- Pause individual assets in shared physics worlds while preserving their poses, contacts and joints; resume their saved motion independently of other assets.

- Preserve articulation collision filtering and stabilize fixed links between bodies with very different masses while retaining joint limits and drives.

- Simulate concave collision meshes, including SDF-labelled source meshes, while preserving cavities and authored collider mass properties.

- Register imported bodies and colliders with Needle Engine through `@needle-tools/simready/needle`, including physics queries, collision events and Engine-owned lifecycle.

- Share mechanism controls and dynamics between USD, glTF and headless applications.
- Join an existing Rapier world while its host retains stepping, collision events and world lifetime.
- Simulate independently loaded assets in an application-owned world with contacts, unit conversion and separate instance identities.
- Load `NEEDLE_simready` assets through an opt-in Three.js loader, with simulation and joint manipulation created on demand.
- Bind individual render instances to explicit bodies, display joint helpers, and control motor targets without changing authored data.
