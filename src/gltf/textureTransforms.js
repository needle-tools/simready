// @ts-check
const normalized = new WeakSet();
/** @param {unknown} value @returns {value is import('three').Texture} */
const isTexture = value => !!value && typeof value === 'object' && Reflect.get(value, 'isTexture') === true;

/** Preserve glTF's T * R * S sampling through Three's clockwise rotation API.
 * @param {object} parser
 */
export function normalizeTextureTransforms(parser) {
	const assign = Reflect.get(parser, 'assignTexture');
	if (normalized.has(parser) || typeof assign !== 'function') return;
	normalized.add(parser);
	/** @type {(...args:unknown[])=>Promise<unknown>} */
	const assignTransformed = async (...args) => {
		const texture = await Reflect.apply(assign, parser, args);
		const definition = args[2];
		if (!definition || typeof definition !== 'object' || !isTexture(texture)) return texture;
		const transform = Reflect.get(definition, 'extensions')?.KHR_texture_transform;
		if (!transform || typeof transform.rotation !== 'number') return texture;
		const map = texture;
		const [sx, sy] = transform.scale || [1, 1];
		const [tx, ty] = transform.offset || [0, 0];
		const c = Math.cos(transform.rotation), s = Math.sin(transform.rotation);
		map.matrix.set(c * sx, -s * sy, tx, s * sx, c * sy, ty, 0, 0, 1);
		map.matrixAutoUpdate = false;
		map.rotation = -transform.rotation;
		return texture;
	};
	Reflect.set(parser, 'assignTexture', assignTransformed);
}
