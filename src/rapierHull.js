// @ts-check
import {Vector3} from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';

/**
 * Native decomposition occasionally returns valid hull vertices with faces that
 * its own convex-mesh cooker rejects. Rebuild only those faces in double
 * precision; keep every hull and its original transform and point set.
 * @param {import('./rapier-types.js').RapierModule} R
 * @param {import('./rapier-types.js').ColliderDescriptor} descriptor
 * @param {string} path
 * @param {import('./description.js').Adaptation[]} adaptations
 */
export function repairConvexCompound(R, descriptor, path, adaptations) {
    const parts = descriptor.shape?.shapes;
    if (!parts) return;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part.intoRaw) continue;
        const raw = part.intoRaw();
        if (raw) { raw.free(); continue; }
        const vertices = part.vertices;
        if (!vertices || !R.ColliderDesc.convexMesh) throw new Error(`Cannot cook convex decomposition hull ${i} at ${path}.`);
        const points = Array.from({length: vertices.length / 3}, (_, n) => new Vector3().fromArray(vertices, n * 3));
        const indices = new Map(points.map((point, n) => [point, n]));
        const hull = new ConvexHull().setFromPoints(points), triangles = [];
        for (const face of hull.faces) {
            let edge = face.edge;
            do {
                const index = indices.get(edge.head().point);
                if (index === undefined) throw new Error(`Invalid rebuilt hull at ${path}.`);
                triangles.push(index);
                edge = edge.next;
            } while (edge !== face.edge);
        }
        const rebuilt = R.ColliderDesc.convexMesh(vertices, new Uint32Array(triangles))?.shape;
        const cooked = rebuilt?.intoRaw?.();
        if (!rebuilt || !cooked) throw new Error(`Cannot rebuild convex decomposition hull ${i} at ${path}.`);
        cooked.free();
        parts[i] = rebuilt;
        adaptations.push({path, source: 'convex decomposition hull', target: 'rebuilt convex hull',
            reason: 'Invalid native decomposition faces were rebuilt from the original vertices.'});
    }
}
