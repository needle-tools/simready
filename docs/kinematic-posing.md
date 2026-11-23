# Kinematic posing and joint drives

SimReady has two controllers for the same asset. Physics mode (`createSimulation`) runs
Rapier or Needle Engine dynamics. Kinematic mode (`createMechanism`) poses joints directly,
with no gravity and no contacts. Both read the same joint drives
(`UsdPhysicsDriveAPI`: target, stiffness, damping and force limit), but they use them
differently during interaction.

## Physics mode: the pointer pulls against the drives

Dragging a part in physics mode attaches a spring to the grabbed body, scaled by its mass.
Drives keep acting, so a strong drive resists the pull and a weak one gives way. This matches
interactive picking in Omniverse during simulation.

## Kinematic mode: posing is deliberate

- While dragging, the pointer always reaches its target where the joints allow it. When
  several joints could follow, the lighter ones move more, weighted by the inertia each joint
  carries (`computeMassProperties`). Drives do not resist.
- When you let go, every driven joint the drag moved keeps its new value as its drive target.
  `setJointValue()` does the same. The pose therefore holds instead of springing back.
- Joints you did not move keep their authored targets. With `mechanism.update(dt)` they move
  toward them as springs and dampers in joint space, within their force limits. `reset()`
  restores every authored target. The snapshot itself is never changed.

This follows how NVIDIA's authoring tools pose articulations outside simulation. Isaac Sim's
Robot Poser writes the drive target together with the joint state, so actuators hold the
pose. The Physics Inspector's drive mode likewise moves the drive target and lets the drive
pull the joint there. A pose that only set the joint state would be pulled back to the old
target as soon as drives act, which is why posing updates the target.

SimReady assets have no separate marker for a passive return spring. NVIDIA's guidelines
treat any drive as actuation and describe passive springiness and damping with other
attributes, so kinematic posing treats every drive alike.

## Further reading

- Omniverse interactive picking (physics mode): [`NativeInteraction.cpp`](https://github.com/NVIDIA-Omniverse/PhysX/blob/main/ovphysx/ovruntime/source/omni.physx/plugins/NativeInteraction.cpp)
  and its design record [`ADR-0009-raycast-and-mouse-forces.md`](https://github.com/NVIDIA-Omniverse/PhysX/blob/main/ovphysx/companion/docs/extensions/runtime/adr/ADR-0009-raycast-and-mouse-forces.md).
- Omniverse Physics Inspector, joint state and drive target posing:
  [authoring tools guide](https://docs.omniverse.nvidia.com/kit/docs/omni_physics/latest/extensions/ux/source/omni.physx.supportui/docs/dev_guide/authoring_tools.html),
  [`ADR-0011-physics-inspector.md`](https://github.com/NVIDIA-Omniverse/PhysX/blob/main/ovphysx/companion/docs/extensions/ux/adr/ADR-0011-physics-inspector.md).
- Isaac Sim Robot Poser: [`robot_poser.py`](https://github.com/isaac-sim/IsaacSim/blob/release/6.3/source/extensions/isaacsim.robot.poser/isaacsim/robot/poser/robot_poser.py)
  and [`kinematic_chain.py`](https://github.com/isaac-sim/IsaacSim/blob/release/6.3/source/extensions/isaacsim.robot.poser/isaacsim/robot/poser/kinematic_chain.py),
  which writes `drive:*:physics:targetPosition` and `state:*:physics:position` together.
- SimReady drive guidance in [simready-foundation](https://github.com/NVIDIA/simready-foundation):
  [`no-articulation-loops.md`](https://github.com/NVIDIA/simready-foundation/blob/main/nv_core/tiers/simready_foundation_tier_core/simready/foundation/tier_core/rules_and_reqs/physics_bodies/physics_driven_joints/requirements/no-articulation-loops.md),
  [`newton-mimic-api.md`](https://github.com/NVIDIA/simready-foundation/blob/main/nv_core/tiers/simready_foundation_tier_newton/simready/foundation/tier_newton/rules_and_reqs/physics_bodies/physics_driven_joints/requirements/newton-mimic-api.md),
  [`newton-joint-drive-api.md`](https://github.com/NVIDIA/simready-foundation/blob/main/nv_core/tiers/simready_foundation_tier_newton/simready/foundation/tier_newton/rules_and_reqs/physics_bodies/physics_driven_joints/requirements/newton-joint-drive-api.md) and
  [`newton-joint-attributes.md`](https://github.com/NVIDIA/simready-foundation/blob/main/nv_core/tiers/simready_foundation_tier_newton/simready/foundation/tier_newton/rules_and_reqs/physics_bodies/physics_driven_joints/requirements/newton-joint-attributes.md).
