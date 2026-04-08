import type { Bot } from "mineflayer";
import type { Block } from "prismarine-block";
import { Vec3 } from "vec3";

function createSolidBlock(position: Vec3): Block {
    return {
        name: "grass",
        type: 2,
        boundingBox: "block",
        shapes: [[0, 0, 0, 1, 1, 1]],
        position,
    } as unknown as Block;
}

export function createReplayBot(): Bot {
    return {
        on: () => undefined,
        blockAt: (pos: Vec3) => {
            const floored = pos.floored();
            if (floored.y !== 3) return null;
            if (floored.x < -90 || floored.x > -60) return null;
            if (floored.z < -45 || floored.z > -20) return null;
            return createSolidBlock(floored);
        },
        entity: {
            position: new Vec3(-73.844, 4.0, -32.224),
            yaw: 0,
            pitch: 0,
            velocity: new Vec3(-0.088, -0.078, -0.125),
            onGround: true,
        },
    } as unknown as Bot;
}
