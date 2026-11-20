// @ts-check
import { Extension, ExtensionProperty, PropertyType, RefMap, GLB_BUFFER } from '@gltf-transform/core';
import {NeedleSimreadyExtension,SimreadyData,NEEDLE_SIMREADY} from './runtime-extension.js';

export const PHYSICS_BODIES = 'KHR_physics_rigid_bodies';
export const IMPLICIT_SHAPES = 'KHR_implicit_shapes';
/** One graph-owned blob per input buffer view: several bodies can point into
 * one shared hull stream, including after preview cloning.
 * @extends {ExtensionProperty<import('@gltf-transform/core').IProperty & {bytes: Uint8Array, buffer: import('@gltf-transform/core').Buffer}>} */
// @ts-ignore -- glTF Transform's public base type leaks property-graph in declaration emit.
class PhysicsHullData extends ExtensionProperty {
  static EXTENSION_NAME = PHYSICS_BODIES;
  extensionName = PHYSICS_BODIES;
  propertyType = 'PhysicsHullData';
  parentTypes = ['PhysicsData'];
  init() {}
  getDefaults() { return { ...super.getDefaults(), bytes: new Uint8Array(), buffer: null }; }
  getBytes() { return this.get('bytes'); }
  /** @param {Uint8Array} bytes @param {import('@gltf-transform/core').Buffer} buffer */
  setBytes(bytes, buffer) { this.setRef('buffer', buffer); return this.set('bytes', bytes); }
}

/** @typedef {import('@gltf-transform/core').IProperty & {
 * payload: Record<string, any>, references: import('@gltf-transform/core').RefMap<import('@gltf-transform/core').Node>, hullData: PhysicsHullData,
 * }} IPhysicsData */
/** Index-bearing fields are graph edges, so cloning and reordering cannot
 * leave physics pointing at a different render node or collision mesh.
 * @extends {ExtensionProperty<IPhysicsData>}
 */
// @ts-ignore -- glTF Transform's public base type leaks property-graph in declaration emit.
export class PhysicsData extends ExtensionProperty {
  static EXTENSION_NAME = PHYSICS_BODIES;
  extensionName = PHYSICS_BODIES;
  propertyType = 'PhysicsData';
  parentTypes = [PropertyType.NODE, PropertyType.ROOT];
  init() {}
  /** @returns {import('@gltf-transform/core').Nullable<IPhysicsData>} */
  getDefaults() { return { ...super.getDefaults(), payload: {}, references: new RefMap(), hullData: null }; }
  getPayload() { return this.get('payload'); }
  /** @param {Record<string, any>} value */
  setPayload(value) { return this.set('payload', structuredClone(value)); }
  /** @param {string} path @param {import('@gltf-transform/core').Node} value */
  setReference(path, value) { return this.setRefMap('references', path, value); }
  /** @param {string} path */
  getReference(path) { return this.getRefMap('references', path); }
  referencePaths() { return this.listRefMapKeys('references'); }
  getHullBytes() { return this.getRef('hullData')?.getBytes() ?? null; }
  /** @param {PhysicsHullData} data */
  setHullData(data) { return this.setRef('hullData', data); }
}
/** @extends {ExtensionProperty<import('@gltf-transform/core').IProperty & {payload: Record<string, any>}>} */
// @ts-ignore -- glTF Transform's public base type leaks property-graph in declaration emit.
export class ShapeData extends ExtensionProperty {
  static EXTENSION_NAME = IMPLICIT_SHAPES;
  extensionName = IMPLICIT_SHAPES;
  propertyType = 'ShapeData';
  parentTypes = [PropertyType.ROOT];
  init() {}
  getDefaults() { return { ...super.getDefaults(), payload: {} }; }
  getPayload() { return this.get('payload'); }
  /** @param {Record<string, any>} payload */
  setPayload(payload) { return this.set('payload', structuredClone(payload)); }
}
export class ImplicitShapesExtension extends Extension {
  static EXTENSION_NAME = IMPLICIT_SHAPES;
  extensionName = IMPLICIT_SHAPES;
  /** @param {import('@gltf-transform/core').ReaderContext} context */
  read(context) {
    const data = context.jsonDoc.json.extensions?.[IMPLICIT_SHAPES];
    if (data) this.document.getRoot().setExtension(IMPLICIT_SHAPES, new ShapeData(this.document.getGraph()).setPayload(data));
    return this;
  }
  /** @param {import('@gltf-transform/core').WriterContext} context */
  write(context) {
    const property = this.document.getRoot().getExtension(IMPLICIT_SHAPES);
    if (property instanceof ShapeData) (context.jsonDoc.json.extensions ??= {})[IMPLICIT_SHAPES] = property.getPayload();
    return this;
  }
}
/** @param {Record<string, any>} payload */
function compoundMembers(payload) {
  const members = payload.trigger?.nodes;
  if (members === undefined) return [];
  if (!Array.isArray(members) || !members.length || new Set(members).size !== members.length
    || payload.trigger.geometry !== undefined || payload.trigger.collisionFilter !== undefined) {
    throw new Error('Invalid compound trigger.nodes.');
  }
  return members.map((_, i) => `trigger.nodes.${i}`);
}

/** @param {import('@gltf-transform/core').Node} owner @param {import('@gltf-transform/core').Node} member */
function isDescendant(owner, member) {
  for (let parent = member.getParentNode(); parent; parent = parent.getParentNode()) if (parent === owner) return true;
  return false;
}

export class PhysicsBodiesExtension extends Extension {
  static EXTENSION_NAME = PHYSICS_BODIES;
  extensionName = PHYSICS_BODIES;
  prewriteTypes = [PropertyType.BUFFER];
  /** @param {import('@gltf-transform/core').ReaderContext} context */
  read(context) {
    const root = this.document.getRoot(), json = context.jsonDoc.json;
    /** @type {Map<number, PhysicsHullData>} */
    const hullViews = new Map();
    const legacyNodes = new Map();
    const rootData = json.extensions?.[PHYSICS_BODIES];
    if (rootData) root.setExtension(PHYSICS_BODIES, new PhysicsData(this.document.getGraph()).setPayload(rootData));
    for (const [index, definition] of (json.nodes ?? []).entries()) {
      const payload = definition.extensions?.[PHYSICS_BODIES];
      const hull = /** @type {{bufferView?: number} | undefined} */ (definition.extras?.collisionHulls);
      if (!payload && !hull) continue;
      const property = new PhysicsData(this.document.getGraph()).setPayload(payload ?? {});
      for (const role of ['collider', 'trigger']) {
        const geometry = property.getPayload()[role]?.geometry;
        if (!geometry) continue;
        if (['shape', 'node', 'mesh'].filter(key => geometry[key] !== undefined).length !== 1) {
          throw new Error(`Invalid ${role}.geometry: expected exactly one geometry source.`);
        }
        if (geometry.mesh !== undefined) {
          // Older exports stored a mesh index directly. Keep it outside the render scene.
          const mesh = Number.isInteger(geometry.mesh) && context.meshes[geometry.mesh];
          if (!mesh) throw new Error(`Invalid ${role}.geometry.mesh reference.`);
          let target = legacyNodes.get(mesh);
          if (!target) {
            target = this.document.createNode().setMesh(mesh);
            legacyNodes.set(mesh, target);
          }
          delete geometry.mesh;
          geometry.node = 0; // The graph reference supplies the serialized index.
          property.setReference(`${role}.geometry.node`, target);
        } else if (geometry.node !== undefined) {
          const target = Number.isInteger(geometry.node) && context.nodes[geometry.node];
          if (!target) throw new Error(`Invalid ${role}.geometry.node reference.`);
          property.setReference(`${role}.geometry.node`, target);
        }
      }
      for (const [i, path] of compoundMembers(property.getPayload()).entries()) {
        const member = property.getPayload().trigger.nodes[i];
        if (!Number.isInteger(member) || !(/** @type {{trigger?:object}|undefined} */ (json.nodes?.[member]?.extensions?.[PHYSICS_BODIES]))?.trigger
          || !isDescendant(context.nodes[index], context.nodes[member])) throw new Error(`Invalid ${path} target.`);
        property.setReference(path, context.nodes[member]);
      }
      const connected = property.getPayload().joint?.connectedNode;
      if (connected !== undefined) {
        if (!Number.isInteger(connected) || !context.nodes[connected]) throw new Error('Invalid SimReady joint connectedNode.');
        property.setReference('joint.connectedNode', context.nodes[connected]);
      }
      if (hull) {
        const view = Number.isInteger(hull.bufferView) ? json.bufferViews?.[/** @type {number} */ (hull.bufferView)] : undefined;
        const buffer = view && json.buffers?.[view.buffer];
        const data = buffer && context.jsonDoc.resources[buffer.uri ?? GLB_BUFFER];
        if (!view || !data || (view.byteOffset ?? 0) + view.byteLength > data.byteLength || view.extensions) {
          throw new Error('Unsupported or unavailable SimReady collisionHulls buffer view.');
        }
        const key = /** @type {number} */ (hull.bufferView);
        let blob = hullViews.get(key);
        if (!blob) {
          blob = new PhysicsHullData(this.document.getGraph()).setBytes(
            data.slice(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength), context.buffers[view.buffer]);
          hullViews.set(key, blob);
        }
        property.setHullData(blob);
      }
      context.nodes[index].setExtension(PHYSICS_BODIES, property);
    }
    return this;
  }
  /** @param {import('@gltf-transform/core').WriterContext} context */
  prewrite(context) {
    const root = this.document.getRoot();
    const buffer = root.listBuffers()[0] ?? this.document.createBuffer();
    const views = context.otherBufferViews.get(buffer) ?? [];
    for (const node of root.listNodes()) {
      const property = node.getExtension(PHYSICS_BODIES);
      if (property instanceof PhysicsData) {
        const bytes = property.getHullBytes();
        if (bytes && !views.includes(bytes)) views.push(bytes);
      }
    }
    if (views.length) context.otherBufferViews.set(buffer, views);
    return this;
  }
  /** @param {import('@gltf-transform/core').WriterContext} context */
  write(context) {
    const root = this.document.getRoot();
    const data = root.getExtension(PHYSICS_BODIES);
    if (data instanceof PhysicsData) {
      const payload = structuredClone(data.getPayload());
      for (const key of ['physicsMaterials', 'physicsJoints', 'collisionFilters']) {
        if (Array.isArray(payload[key]) && !payload[key].length) delete payload[key];
      }
      (context.jsonDoc.json.extensions ??= {})[PHYSICS_BODIES] = payload;
    }
    for (const node of root.listNodes()) {
      const property = node.getExtension(PHYSICS_BODIES);
      if (!(property instanceof PhysicsData)) continue;
      const payload = structuredClone(property.getPayload());
      const paths = [];
      for (const role of ['collider', 'trigger']) {
        const geometry = payload[role]?.geometry;
        if (!geometry) continue;
        if (geometry.mesh !== undefined || (geometry.node !== undefined) === (geometry.shape !== undefined)) {
          throw new Error(`Invalid ${role}.geometry: expected exactly one node or shape reference.`);
        }
        if (geometry.node !== undefined) paths.push(`${role}.geometry.node`);
      }
      if (payload.joint?.connectedNode !== undefined) paths.push('joint.connectedNode');
      paths.push(...compoundMembers(payload));
      for (const path of paths) {
        const target = property.getReference(path);
        const index = target && context.nodeIndexMap.get(target);
        if (index == null) throw new Error(`SimReady ${path} target was removed during optimization.`);
        if (path.startsWith('trigger.nodes.') && (!(/** @type {PhysicsData|null} */ (target?.getExtension(PHYSICS_BODIES)))?.getPayload().trigger
          || !isDescendant(node, target))) throw new Error(`Invalid ${path} target.`);
        const keys = path.split('.');
        let parent = payload;
        for (const key of keys.slice(0, -1)) parent = parent[key];
        parent[keys[keys.length - 1]] = index;
      }
      const definition = context.jsonDoc.json.nodes?.[/** @type {number} */ (context.nodeIndexMap.get(node))];
      if (!definition) throw new Error('SimReady body node was removed during export.');
      (definition.extensions ??= {})[PHYSICS_BODIES] = payload;
      const bytes = property.getHullBytes();
      if (bytes) {
        const bufferView = context.otherBufferViewsIndexMap.get(bytes);
        if (bufferView === undefined) throw new Error('SimReady collision hull bytes were removed during export.');
        definition.extras = { ...definition.extras, collisionHulls: { .../** @type {object} */ (node.getExtras().collisionHulls), bufferView } };
      }
    }
    return this;
  }
}
/** @param {import('@gltf-transform/core').PlatformIO} io */
export function registerSimreadyExtensions(io) {
  return io.registerExtensions(SIMREADY_EXTENSIONS);
}
/** @param {import('@gltf-transform/core').Node} node */
export function hasPhysics(node) {
  return Boolean(node.getExtension(PHYSICS_BODIES)) || Array.isArray(node.getExtras().joints) || typeof node.getExtras().mass === 'number';
}
export const simulationExtensions = Object.freeze([NEEDLE_SIMREADY, PHYSICS_BODIES, IMPLICIT_SHAPES]);
/** @param {import('@gltf-transform/core').GLTF.IGLTF} json */
export function hasSimreadyInput(json) {
  return Boolean(json.extensionsUsed?.some(name => simulationExtensions.includes(name))
    || json.nodes?.some(node => Array.isArray(node.extras?.joints) || typeof node.extras?.mass === 'number'));
}
/** @param {import('@gltf-transform/core').Document} document */
export function hasSimready(document) {
  const root = document.getRoot();
  return root.listExtensionsUsed().some(extension => simulationExtensions.includes(extension.extensionName))
    || root.listNodes().some(hasPhysics);
}
/** Collision-only nodes must stay serializable without becoming bake sources. */
/** @param {import('@gltf-transform/core').Document} document */
export function renderNodes(document) {
  const nodes = new Set(/** @type {import('@gltf-transform/core').Node[]} */ ([]));
  for (const scene of document.getRoot().listScenes()) scene.traverse(node => nodes.add(node));
  return [...nodes];
}
/** Snapshot collision geometry before visual optimization can replace it.
 * Detached nodes are referenced by the draft's geometry.node dialect; the
 * mesh dialect uses a direct graph edge. Both keep the authored collider.
 * Returns the scene's visual meshes for subsequent processing.
 * @param {import('@gltf-transform/core').Document} document */
export function retainCollisionGeometry(document) {
  const rendered = new Set(renderNodes(document));
  /** @type {Set<import('@gltf-transform/core').Mesh>} */
  const renderedMeshes = new Set();
  for (const node of rendered) {
    const mesh = node.getMesh();
    if (mesh) renderedMeshes.add(mesh);
  }
  /** @type {Map<import('@gltf-transform/core').Mesh, import('@gltf-transform/core').Mesh>} */
  const meshes = new Map();
  /** Physics uses positions and triangle connectivity; retaining visual UVs,
   * normals and textures here would ship the entire original appearance too.
   * @param {import('@gltf-transform/core').Mesh} source */
  const collisionMesh = source => {
    const cached = meshes.get(source);
    if (cached) return cached;
    if (!renderedMeshes.has(source) && source.listPrimitives().every(primitive => primitive.listSemantics().length === 1
      && primitive.getAttribute('POSITION') && !primitive.getMaterial() && !primitive.listTargets().length)) return source;
    const mesh = document.createMesh(`${source.getName()} collision geometry`);
    for (const primitive of source.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION');
      if (!positions) throw new Error('SimReady collision geometry is missing positions.');
      mesh.addPrimitive(document.createPrimitive().setMode(primitive.getMode())
        .setAttribute('POSITION', positions).setIndices(primitive.getIndices()));
    }
    meshes.set(source, mesh);
    return mesh;
  };
  /** @type {Map<import('@gltf-transform/core').Node, import('@gltf-transform/core').Node>} */
  const frames = new Map();
  /** Preserve the complete frame chain outside the scene. Flattening its
   * matrix into one TRS node would lose shear from rotated scaled parents.
   * @param {import('@gltf-transform/core').Node} source
   * @returns {import('@gltf-transform/core').Node} */
  const collisionFrame = source => {
    const existing = frames.get(source);
    if (existing) return existing;
    const frame = document.createNode(`${source.getName()} collision geometry`)
      .setTranslation(source.getTranslation()).setRotation(source.getRotation()).setScale(source.getScale());
    frames.set(source, frame);
    const parent = source.getParentNode();
    if (parent) collisionFrame(parent).addChild(frame);
    return frame;
  };
  for (const node of document.getRoot().listNodes()) {
    const property = node.getExtension(PHYSICS_BODIES);
    if (!(property instanceof PhysicsData)) continue;
    for (const role of ['collider', 'trigger']) {
      const path = `${role}.geometry.node`;
      const target = property.getReference(path);
      const targetMesh = target?.getMesh();
      // A referenced subtree, skin, morph or animated frame must keep its graph bindings.
      if (!target || !targetMesh || target.listChildren().length || target.getSkin()
        || targetMesh.listPrimitives().some(p => p.listTargets().length)) continue;
      let animated = false;
      for (let frame = /** @type {import('@gltf-transform/core').Node|null} */ (target); frame; frame = frame.getParentNode()) {
        if (frame.listParents().some(p => p.propertyType === PropertyType.ANIMATION_CHANNEL)) animated = true;
      }
      if (animated) continue;
      if (rendered.has(target)) {
        property.setReference(path, collisionFrame(target).setMesh(collisionMesh(targetMesh)));
      } else if (renderedMeshes.has(targetMesh)) {
        target.setMesh(collisionMesh(targetMesh));
      }
    }
  }
  const simready = document.getRoot().getExtension(NEEDLE_SIMREADY);
  if (simready instanceof SimreadyData) for (const path of simready.meshPaths()) {
    const mesh = simready.getMesh(path);
    if (mesh) simready.setMesh(path, collisionMesh(mesh));
  }
  for (const mesh of simulationResources(document).collisionMeshes) renderedMeshes.delete(mesh);
  return renderedMeshes;
}
/** @param {import('@gltf-transform/core').Property} property */
export function physicsOwns(property) { return property.listParents().some(parent => parent instanceof PhysicsData||parent instanceof SimreadyData); }

export { NeedleSimreadyExtension, SimreadyData, NEEDLE_SIMREADY };
export const SIMREADY_EXTENSIONS = [PhysicsBodiesExtension, ImplicitShapesExtension, NeedleSimreadyExtension];

/** Graph-owned resources whose coordinates or identity carry simulation meaning.
 * @param {import('@gltf-transform/core').Document} document
 */
export function simulationResources(document) {
	/** @type {Set<import('@gltf-transform/core').Mesh>} */
	const collisionMeshes = new Set();
	/** @type {Set<import('@gltf-transform/core').Node>} */
	const simulationNodes = new Set();
	const root = document.getRoot();
	for (const node of root.listNodes()) {
		const physics = node.getExtension(PHYSICS_BODIES);
		if (!(physics instanceof PhysicsData)) continue;
		simulationNodes.add(node);
		for (const path of physics.referencePaths()) {
			const target = physics.getReference(path);
			if (target) simulationNodes.add(target);
		}
		for (const role of ['collider', 'trigger']) {
			const target = physics.getReference(`${role}.geometry.node`);
			if (target) target.traverse(child => {
				simulationNodes.add(child);
				const geometry = child.getMesh();
				if (geometry) collisionMeshes.add(geometry);
			});
		}
	}
	const runtime = root.getExtension(NEEDLE_SIMREADY);
	if (runtime instanceof SimreadyData) {
		for (const path of runtime.referencePaths()) {
			const node = runtime.getReference(path);
			if (node) simulationNodes.add(node);
		}
		for (const path of runtime.meshPaths()) {
			const mesh = runtime.getMesh(path);
			if (mesh) collisionMeshes.add(mesh);
		}
	}
	return { collisionMeshes, simulationNodes };
}
