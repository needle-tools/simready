/** A 3 mm/revolution screw with 80 mm of travel and a 9600 degree hard stop. */
export const screwSnapshot = () => ({
    metersPerUnit: 1,
    kilogramsPerUnit: 1,
    upAxis: 'Y',
    scenes: [
        { path: '/Scene', gravityMagnitude: 0, gravityDirection: [0, -1, 0] },
    ],
    materials: [],
    groups: [],
    unsupported: [],
    bodies: [
        {
            path: '/Rotor',
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            mass: 1,
        },
        {
            path: '/Slide',
            position: [0, 0.4, 0],
            rotation: [0, 0, 0, 1],
            mass: 1,
        },
    ],
    shapes: [
        {
            path: '/Rotor/Shape',
            body: '/Rotor',
            type: 'cube',
            halfExtents: [0.1, 0.1, 0.1],
        },
        {
            path: '/Slide/Shape',
            body: '/Slide',
            type: 'cube',
            halfExtents: [0.01, 0.01, 0.01],
        },
    ],
    joints: [
        {
            path: '/Motor',
            type: 'revolute',
            body1: '/Rotor',
            axis: 'Z',
            limit: { enabled: true, lower: 0, upper: 9600 },
            position0: [0, 0, 0],
            position1: [0, 0, 0],
            rotation0: [0, 0, 0, 1],
            rotation1: [0, 0, 0, 1],
            drive: {
                enabled: true,
                targetPosition: 0,
                targetVelocity: 720,
                stiffness: 0,
                damping: 10,
            },
        },
        {
            path: '/ScrewSlide',
            type: 'prismatic',
            body1: '/Slide',
            axis: 'X',
            position0: [0, 0.4, 0],
            position1: [0, 0, 0],
            rotation0: [0, 0, 0, 1],
            rotation1: [0, 0, 0, 1],
            mimic: { joint: '/Motor', multiplier: 0.003 / 360, offset: 0 },
            limit: { enabled: true, lower: 0, upper: 0.08 },
        },
    ],
});
/** Single rotor whose identical orientation can represent several authored turns. */
export function offsetRotorSnapshot(sign) {
    const data = screwSnapshot();
    data.bodies = data.bodies.slice(0, 1);
    data.shapes = data.shapes.slice(0, 1);
    data.joints = data.joints.slice(0, 1);
    data.joints[0].limit = {
        enabled: true,
        lower: sign > 0 ? 720 : -1080,
        upper: sign > 0 ? 1080 : -720,
    };
    data.joints[0].drive = {
        enabled: true,
        targetPosition: sign * 900,
        targetVelocity: 0,
        stiffness: 20,
        damping: 10,
    };
    return data;
}
