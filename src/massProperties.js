import { Matrix4, Quaternion, Vector3 } from 'three';

/** @param {import('./index.js').PhysicsVector | Float32Array | import('three').Vector3Like} value */
const vec = value => Array.isArray(value) || ArrayBuffer.isView(value)
    ? new Vector3().fromArray(value) : new Vector3().copy(value);
/** @param {import('./index.js').PhysicsRotation | Float32Array | import('three').QuaternionLike} value */
const quat = value => Array.isArray(value) || ArrayBuffer.isView(value)
    ? new Quaternion().fromArray(value) : new Quaternion().copy(value);

/**
 * Move a computed inertia tensor to an authored center of mass, following
 * UsdPhysicsMassProperties::TranslateInertia. Inputs share one body-local,
 * scale-free frame; mass and diagonalInertia must already use the same units.
 * Returns Rapier-compatible diagonal moments and their local principal frame.
 */
/** @param {import('./index.js').PhysicsVector | Float32Array | import('three').Vector3Like} diagonalInertia
 * @param {import('./index.js').PhysicsRotation | Float32Array | import('three').QuaternionLike} principalAxes
 * @param {number} mass
 * @param {import('./index.js').PhysicsVector | Float32Array | import('three').Vector3Like} oldCenterOfMass
 * @param {import('./index.js').PhysicsVector | Float32Array | import('three').Vector3Like} newCenterOfMass
 */
export function shiftInertiaToCenterOfMass(diagonalInertia, principalAxes, mass, oldCenterOfMass, newCenterOfMass) {
    const diagonal = vec(diagonalInertia);
    const frame = quat(principalAxes);
    const delta = vec(newCenterOfMass).sub(vec(oldCenterOfMass));
    if (![...diagonal.toArray(), ...frame.toArray(), ...delta.toArray(), mass].every(Number.isFinite)
        || mass < 0 || diagonal.toArray().some(value => value < 0) || frame.lengthSq() === 0) {
        throw new RangeError('Inertia translation requires finite mass properties, nonnegative moments and a valid principal frame.');
    }
    frame.normalize();
    if (mass === 0 || delta.lengthSq() === 0) return { diagonalInertia: diagonal, principalAxes: frame };

    const rotation = new Matrix4().makeRotationFromQuaternion(frame).elements;
    const moments = diagonal.toArray(), displacement = delta.toArray();
    const tensor = new Array(9).fill(0);
    // R diag(I) R^T + m (|d|² identity - d d^T), stored row-major.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        for (let axis = 0; axis < 3; axis++) tensor[row * 3 + col] += rotation[axis * 4 + row] * moments[axis] * rotation[axis * 4 + col];
        tensor[row * 3 + col] += mass * ((row === col ? delta.lengthSq() : 0) - displacement[row] * displacement[col]);
    }

    return principalInertia(tensor);
}

/** Diagonalize a symmetric row-major 3x3 inertia tensor into nonnegative principal moments
 * and a right-handed principal frame.
 * @param {number[]} tensor */
function principalInertia(tensor) {
    tensor = [...tensor];
    // Jacobi rotations diagonalize this symmetric 3x3 matrix. Accumulating
    // rotations preserves a right-handed orthonormal principal frame, including
    // repeated eigenvalues. No eigenvalue sorting/sign convention is required.
    const basis = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let iteration = 0; iteration < 32; iteration++) {
        let p = 0, q = 1;
        for (const [row, col] of [[0, 2], [1, 2]]) {
            if (Math.abs(tensor[row * 3 + col]) > Math.abs(tensor[p * 3 + q])) { p = row; q = col; }
        }
        const offDiagonal = tensor[p * 3 + q];
        const scale = Math.max(Math.abs(tensor[0]), Math.abs(tensor[4]), Math.abs(tensor[8]));
        if (Math.abs(offDiagonal) <= Number.EPSILON * 32 * scale) break;
        const tau = (tensor[q * 3 + q] - tensor[p * 3 + p]) / (2 * offDiagonal);
        const tangent = (tau < 0 ? -1 : 1) / (Math.abs(tau) + Math.hypot(1, tau));
        const cosine = 1 / Math.hypot(1, tangent), sine = tangent * cosine;
        tensor[p * 3 + p] -= tangent * offDiagonal;
        tensor[q * 3 + q] += tangent * offDiagonal;
        tensor[p * 3 + q] = tensor[q * 3 + p] = 0;
        for (let k = 0; k < 3; k++) {
            if (k !== p && k !== q) {
                const kp = tensor[k * 3 + p], kq = tensor[k * 3 + q];
                tensor[k * 3 + p] = tensor[p * 3 + k] = cosine * kp - sine * kq;
                tensor[k * 3 + q] = tensor[q * 3 + k] = sine * kp + cosine * kq;
            }
            const kp = basis[k * 3 + p], kq = basis[k * 3 + q];
            basis[k * 3 + p] = cosine * kp - sine * kq;
            basis[k * 3 + q] = sine * kp + cosine * kq;
        }
    }
    const principalMatrix = new Matrix4().set(
        basis[0], basis[1], basis[2], 0,
        basis[3], basis[4], basis[5], 0,
        basis[6], basis[7], basis[8], 0,
        0, 0, 0, 1,
    );
    return {
        diagonalInertia: new Vector3(Math.max(0, tensor[0]), Math.max(0, tensor[4]), Math.max(0, tensor[8])),
        principalAxes: new Quaternion().setFromRotationMatrix(principalMatrix).normalize(),
    };
}

/** @typedef {{mass:number,centerOfMass:import('./index.js').PhysicsVector,diagonalInertia:import('./index.js').PhysicsVector,
 * principalAxes:import('./index.js').PhysicsRotation,source:'authored'|'colliders'|'default'}} BodyMassProperties */

const positive = (/** @type {number|null|undefined} */ value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const outer = (/** @type {Vector3} */ v) => [v.x * v.x, v.x * v.y, v.x * v.z, v.y * v.x, v.y * v.y, v.y * v.z, v.z * v.x, v.z * v.y, v.z * v.z];

/** Inertia of a point-mass-free tensor moved from its center of mass by `offset` (parallel axis theorem).
 * @param {number[]} tensor @param {number} mass @param {Vector3} offset */
function translated(tensor, mass, offset) {
    const d = outer(offset), length = offset.lengthSq();
    return tensor.map((value, i) => value + mass * ((i % 4 === 0 ? length : 0) - d[i]));
}

/** @param {number[]} tensor @param {Quaternion} rotation R I R^T */
function rotated(tensor, rotation) {
    const r = new Matrix4().makeRotationFromQuaternion(rotation).elements, out = new Array(9).fill(0);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++)
        out[row * 3 + col] += r[a * 4 + row] * tensor[a * 3 + b] * r[b * 4 + col];
    return out;
}

/** @param {number} x @param {number} y @param {number} z */
const diagonal = (x, y, z) => [x, 0, 0, 0, y, 0, 0, 0, z];

/** Unit-density volume, center and inertia of a closed triangle mesh, by signed tetrahedra.
 * @param {ArrayLike<number>} points @param {ArrayLike<number>} indices */
function meshIntegrals(points, indices) {
    let volume = 0;
    const center = new Vector3(), second = new Array(9).fill(0), a = new Vector3(), b = new Vector3(), c = new Vector3(), sum = new Vector3();
    for (let i = 0; i + 2 < indices.length; i += 3) {
        a.fromArray(points, indices[i] * 3); b.fromArray(points, indices[i + 1] * 3); c.fromArray(points, indices[i + 2] * 3);
        const det = a.dot(new Vector3().crossVectors(b, c));
        volume += det / 6;
        sum.copy(a).add(b).add(c);
        center.addScaledVector(sum, det / 24);
        const s = outer(sum), va = outer(a), vb = outer(b), vc = outer(c);
        for (let k = 0; k < 9; k++) second[k] += det / 120 * (va[k] + vb[k] + vc[k] + s[k]);
    }
    if (!(Math.abs(volume) > 0)) return null;
    if (volume < 0) { volume = -volume; center.negate(); for (let k = 0; k < 9; k++) second[k] = -second[k]; }
    center.divideScalar(volume);
    const trace = second[0] + second[4] + second[8];
    const origin = second.map((value, k) => (k % 4 === 0 ? trace : 0) - value);
    return {volume, center, inertia: translated(origin, -volume, center)};
}

/** Unit-density volume, local center and inertia of a collider, or null when it has no volume.
 * Capsules, cylinders and cones follow the description's axis convention, X when unset.
 * @param {import('./index.js').PhysicsShape} data */
function shapeIntegrals(data) {
    const axisRotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0),
        new Vector3(...(data.axis === 'Y' ? [0, 1, 0] : data.axis === 'Z' ? [0, 0, 1] : [1, 0, 0])));
    const r = data.radius ?? 0, h = data.halfHeight ?? 0;
    switch (data.type) {
        case 'cube': {
            const [x, y, z] = data.halfExtents ?? [0, 0, 0], volume = 8 * x * y * z;
            return {volume, center: new Vector3(), inertia: diagonal(volume * (y * y + z * z) / 3, volume * (x * x + z * z) / 3, volume * (x * x + y * y) / 3)};
        }
        case 'sphere': {
            const volume = 4 / 3 * Math.PI * r ** 3, moment = 2 / 5 * volume * r * r;
            return {volume, center: new Vector3(), inertia: diagonal(moment, moment, moment)};
        }
        case 'cylinder': {
            const volume = Math.PI * r * r * 2 * h, across = volume * (3 * r * r + 4 * h * h) / 12;
            return {volume, center: new Vector3(), inertia: rotated(diagonal(across, volume * r * r / 2, across), axisRotation)};
        }
        case 'capsule': {
            const cylinder = Math.PI * r * r * 2 * h, cap = 2 / 3 * Math.PI * r ** 3, volume = cylinder + 2 * cap;
            const across = cylinder * (3 * r * r + 4 * h * h) / 12 + 2 * cap * (2 * r * r / 5 + h * h + 3 * h * r / 4);
            return {volume, center: new Vector3(), inertia: rotated(diagonal(across, cylinder * r * r / 2 + 2 * cap * 2 * r * r / 5, across), axisRotation)};
        }
        case 'cone': {
            // The base sits at -halfHeight and the apex at +halfHeight.
            const volume = Math.PI * r * r * 2 * h / 3, across = volume * (3 * r * r / 20 + 3 * (2 * h) ** 2 / 80);
            return {volume, center: new Vector3(0, -h / 2, 0).applyQuaternion(axisRotation), inertia: rotated(diagonal(across, 3 / 10 * volume * r * r, across), axisRotation)};
        }
        case 'mesh': {
            const scale = data.meshScale ?? [1, 1, 1], source = data.points ?? [];
            const points = Float64Array.from(source, (v, i) => v * scale[i % 3]);
            if (!points.length) return null;
            const closed = data.indices?.length ? meshIntegrals(points, data.indices) : null;
            const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity), p = new Vector3();
            for (let i = 0; i < points.length; i += 3) { p.fromArray(points, i); min.min(p); max.max(p); }
            const size = max.clone().sub(min), boxVolume = size.x * size.y * size.z;
            // Open or inside-out surfaces have no reliable enclosed volume: use their bounds instead.
            if (closed && closed.volume > boxVolume * 1e-6) return closed;
            const [x, y, z] = size.clone().multiplyScalar(.5).toArray();
            if (!(boxVolume > 0)) return null;
            return {volume: boxVolume, center: min.add(max).multiplyScalar(.5), inertia: diagonal(boxVolume * (y * y + z * z) / 3, boxVolume * (x * x + z * z) / 3, boxVolume * (x * x + y * y) / 3)};
        }
        default: return null;
    }
}

/**
 * Mass, center of mass and principal inertia of every body in a snapshot, in the
 * snapshot's units and each body's local frame. Follows USD's precedence: an authored
 * body mass wins, otherwise the colliders' masses add up. A collider uses its authored
 * mass, else its volume times the collider's, the body's or its material's density,
 * else 1000 kg/m³. Authored centers of mass and inertia override derived ones. A body
 * with no colliders and no authored mass gets mass 1 and unit inertia.
 * @param {import('./index.js').PhysicsSnapshot} snapshot
 * @returns {Map<string,BodyMassProperties>}
 */
export function computeMassProperties(snapshot) {
    const mpu = positive(snapshot.metersPerUnit) ? snapshot.metersPerUnit ?? 1 : 1;
    const kgpu = positive(snapshot.kilogramsPerUnit) ? snapshot.kilogramsPerUnit ?? 1 : 1;
    const water = 1000 * mpu ** 3 / kgpu;
    const materials = new Map((snapshot.materials || []).map(material => [material.path, material]));
    /** @type {Map<string,{mass:number,first:Vector3,tensor:number[]}[]>} */
    const parts = new Map();
    const bodies = new Map((snapshot.bodies || []).map(body => [body.path, body]));
    for (const data of snapshot.shapes || []) {
        const owner = data.body ? bodies.get(data.body) : undefined;
        if (!owner || data.collisionEnabled === false) continue;
        const integrals = shapeIntegrals(data);
        const material = data.materials?.map(path => materials.get(path)).find(Boolean);
        const density = positive(data.density) ? data.density ?? 0 : positive(owner.density) ? owner.density ?? 0
            : positive(material?.density) ? material?.density ?? 0 : water;
        const mass = positive(data.mass) ? data.mass ?? 0 : integrals ? integrals.volume * density : 0;
        if (!(mass > 0)) continue;
        let center = integrals?.center.clone() ?? new Vector3();
        let tensor = integrals ? integrals.inertia.map(value => value * mass / integrals.volume) : diagonal(0, 0, 0);
        if (data.centerOfMass) center = new Vector3(...data.centerOfMass);
        if (data.diagonalInertia) tensor = rotated(diagonal(...data.diagonalInertia), new Quaternion(...(data.principalAxes ?? [0, 0, 0, 1])));
        else if (data.centerOfMass && integrals) tensor = translated(tensor, mass, center.clone().sub(integrals.center));
        // Into the body frame.
        const rotation = new Quaternion(...(data.rotation ?? [0, 0, 0, 1])).normalize(), position = new Vector3(...(data.position ?? [0, 0, 0]));
        const list = parts.get(owner.path) ?? [];
        list.push({mass, first: center.applyQuaternion(rotation).add(position), tensor: rotated(tensor, rotation)});
        parts.set(owner.path, list);
    }
    /** @type {Map<string,BodyMassProperties>} */
    const result = new Map();
    for (const body of bodies.values()) {
        const list = parts.get(body.path) ?? [];
        let mass = list.reduce((sum, part) => sum + part.mass, 0);
        const center = new Vector3();
        for (const part of list) center.addScaledVector(part.first, part.mass / mass);
        let tensor = new Array(9).fill(0);
        for (const part of list) tensor = translated(part.tensor, part.mass, part.first.clone().sub(center)).map((value, i) => value + tensor[i]);
        /** @type {BodyMassProperties['source']} */
        let source = list.length ? 'colliders' : 'default';
        if (positive(body.mass)) {
            // An authored total scales the derived distribution.
            const ratio = mass > 0 ? (body.mass ?? 0) / mass : 0;
            tensor = tensor.map(value => value * ratio);
            mass = body.mass ?? 0; source = 'authored';
        }
        if (!(mass > 0)) { mass = 1; tensor = diagonal(1, 1, 1); }
        if (body.centerOfMass) {
            const authored = new Vector3(...body.centerOfMass);
            if (!body.diagonalInertia) tensor = shiftTensor(tensor, mass, center, authored);
            center.copy(authored); source = 'authored';
        }
        let principal = principalInertia(tensor);
        if (body.diagonalInertia) {
            principal = {diagonalInertia: new Vector3(...body.diagonalInertia), principalAxes: new Quaternion(...(body.principalAxes ?? [0, 0, 0, 1])).normalize()};
            source = 'authored';
        } else if (body.principalAxes) principal.principalAxes = new Quaternion(...body.principalAxes).normalize();
        result.set(body.path, {mass, centerOfMass: center.toArray(), diagonalInertia: principal.diagonalInertia.toArray(),
            principalAxes: /** @type {import('./index.js').PhysicsRotation} */ (principal.principalAxes.toArray()), source});
    }
    return result;
}

/** Move a tensor about `from` to one about `to` for a body of `mass`.
 * @param {number[]} tensor @param {number} mass @param {Vector3} from @param {Vector3} to */
function shiftTensor(tensor, mass, from, to) {
    // Back to the center of mass of the distribution, then out to the new point.
    return translated(tensor, mass, to.clone().sub(from));
}
