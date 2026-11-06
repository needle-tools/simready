# USD coupling metadata

Standard UsdPhysics describes bodies, colliders, joints and drives. SimReady adds
scalar coupling metadata for gears, screws and other linked joint controls. This is
the existing Needle USD convention, not a new PhysX schema or a claim that core-only
USD readers execute coupling.

Use the browser/Worker-safe `@needle-tools/simready/usd` entry in a USD writer:

```js
import {encodeUsdJointMetadata} from '@needle-tools/simready/usd';
const metadata = encodeUsdJointMetadata(joint, sourcePath => exportedPaths.get(sourcePath));
// Write attributes as custom typed USD properties and relationships as custom rels.
```

`metadata.attributes` contains `{name,type,value}` records and
`metadata.relationships` contains `{name,targets}` records. The `simready:mimicOf`
relationship identifies the exported leader joint. `simready:mimicGearing` and
`simready:mimicOffset` are doubles satisfying:

```
follower + gearing * leader + offset = 0
```

The snapshot convention is `follower = multiplier * leader + offset`, so both
coefficients change sign on the wire. Values retain source stage units and degrees;
a rack/screw multiplier may combine length and angle units. Identity remapping is
explicit and does not change the source snapshot.

Readers can pass native attribute values and relationship targets to the same codec:

```js
import {decodeUsdJointMetadata} from '@needle-tools/simready/usd';
const mimic = decodeUsdJointMetadata(attributeValuesByName, relationshipTargetsByName);
if (mimic) joint.mimic = mimic;
```

Absent coupling yields `undefined`; malformed coefficients or multiple reference
joints reject instead of becoming plausible partial motion. Legacy `simready:coupled*`
names remain readable. The resulting snapshot works with the ordinary mechanism and
dynamics APIs. A matching USD reader still supplies the native bodies, joint frames,
limits and geometry; this module needs no USD runtime, renderer or file access.
