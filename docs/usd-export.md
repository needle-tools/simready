# USD export integration

The USD producer converts physics into glTF metres, kilograms, Y-up coordinates and radian joint values. Collider geometry uses ordinary glTF mesh references. Standard Khronos physics extensions carry the portable physics representation.

`NEEDLE_simready` connects that representation to the runtime through its version, stage node, snapshot, visual bindings, semantic labels and mapping issues. The [schema](../extensions/NEEDLE_simready/schema/glTF.NEEDLE_simready.schema.json) defines the wire contract.

Use `createSimreadyExtension` to serialize the descriptor and `registerSimreadyLoader` to activate it in Three.js. Loading exposes `runtime.snapshot`, `runtime.semantics`, `runtime.createMechanism` and `runtime.createSimulation`; it does not start simulation. Dispose an active controller before switching between interaction and dynamics.

Native authoring data stays with the USD source and its catalogue. Material textures and geometry belong in ordinary glTF resources.
