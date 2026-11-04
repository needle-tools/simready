import {createNeedleWorld} from './needle/world.js';

/** Share Needle's Rapier world and register imported physics as Engine components. */
export async function createNeedleSimulationWorld({context, ...options} = {}) {
    const engine = await import('@needle-tools/engine');
    return createNeedleWorld(engine, {context, ...options});
}
