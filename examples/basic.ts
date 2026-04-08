import { createBot } from "mineflayer";
import enderPearling from "../src/index";
import { Vec3 } from "vec3";
import utilPlugin from "@nxg-org/mineflayer-util-plugin"
import {pathfinder, goals} from "mineflayer-pathfinder"
import type { Entity } from "prismarine-entity";
import type { Block } from "prismarine-block";
import { promisify } from "util";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { EnderShotFactory } from "../src/enderShotFactory";

const sleep = promisify(setTimeout)

const bot = createBot({
    username: "ender-testing",
    host: process.argv[2] ?? "localhost",
    port: Number(process.argv[3]) ?? 25565,
});

bot.loadPlugin(utilPlugin)
bot.loadPlugin(enderPearling);
bot.loadPlugin(pathfinder);
let pearlThrown: boolean = false

//lazy implementation. Will automate throwing later.
// bot.on("physicsTick", async () => {
//     target = bot.nearestEntity((e) => e.type === "player" && e !== bot.entity);
//     if (!target) return;
//     if (target.position.distanceTo(bot.entity.position) > 10) {
//         if (!pearlThrown) pearlThrown = await pearl(target.username);
//     } else {
//         come(target.username);
//         pearlThrown = false;
//     }
// });

bot._client.prependListener("entity_velocity", (packet: any) => {
    if (packet.entityId === bot.entity.id) {
        bot.entity.velocity.set(0, 0, 0)
    }

})


bot.on("chat", async (username, message) => {
    const split = message.split(" ");
    switch (split[0]) {
        case "pearl":
            pearl(split[1] ?? username, split[2])
            break;
        case "come":
        case "here":
            come(split[1] ?? username)
            break;
        case "stop":
        case "cease":
            bot.pathfinder.setGoal(null);
            break;
    }
});

function vecToJSON(vec: Vec3 | null | undefined) {
    if (!vec) return null;
    return { x: vec.x, y: vec.y, z: vec.z };
}

function resolveLogPath(logArg?: string) {
    if (!logArg) return null;
    const wantsDefaultLog = logArg === "log" || logArg === "true" || logArg === "1";
    if (wantsDefaultLog) {
        const logDir = path.resolve(process.cwd(), "shot-logs");
        mkdirSync(logDir, { recursive: true });
        return path.join(logDir, `pearl-shot-${Date.now()}.json`);
    }

    const resolved = path.resolve(process.cwd(), logArg);
    mkdirSync(path.dirname(resolved), { recursive: true });
    return resolved;
}

function writeShotLog(logPath: string, pearlTarget: Entity, pearlBlock: Block, face: number, shotInfo: any) {
    const originVel = bot.entity.velocity.clone().translate(0, bot.entity.onGround ? -bot.entity.velocity.y : 0, 0);
    const reconstructedShot = EnderShotFactory.fromPlayer(
        {
            position: bot.entity.position.clone(),
            yaw: shotInfo.yaw,
            pitch: shotInfo.pitch,
            velocity: originVel.clone(),
        },
        bot
    );
    const reconstructedShotInfo = reconstructedShot.calcToBlock(pearlBlock, true);

    const payload = {
        createdAt: new Date().toISOString(),
        command: {
            name: "pearl",
            targetName: pearlTarget.username ?? pearlTarget.name ?? null,
            face,
            logPath,
        },
        bot: {
            username: bot.username,
            position: vecToJSON(bot.entity.position),
            velocity: vecToJSON(bot.entity.velocity),
            originVelocity: vecToJSON(originVel),
            yaw: bot.entity.yaw,
            pitch: bot.entity.pitch,
            onGround: bot.entity.onGround,
        },
        target: {
            entityId: pearlTarget.id,
            username: pearlTarget.username ?? null,
            name: pearlTarget.name ?? null,
            type: pearlTarget.type,
            kind: pearlTarget.kind,
            position: vecToJSON(pearlTarget.position),
            velocity: vecToJSON(pearlTarget.velocity),
            height: pearlTarget.height ?? null,
            width: pearlTarget.width ?? null,
        },
        block: {
            name: pearlBlock.name,
            type: pearlBlock.type,
            position: vecToJSON(pearlBlock.position),
            shapes: pearlBlock.shapes ?? null,
            boundingBox: pearlBlock.boundingBox ?? null,
        },
        selectedShot: {
            hit: shotInfo.hit,
            yaw: shotInfo.yaw,
            pitch: shotInfo.pitch,
            ticks: shotInfo.ticks,
            shotInfo: shotInfo.shotInfo
                ? {
                    XZLandingDistance: shotInfo.shotInfo.XZLandingDistance,
                    YLandingDistance: shotInfo.shotInfo.YLandingDistance,
                    totalTicks: shotInfo.shotInfo.totalTicks,
                    blockFace: shotInfo.shotInfo.blockFace ?? null,
                    closestPoint: vecToJSON(shotInfo.shotInfo.closestPoint),
                    block: shotInfo.shotInfo.block
                        ? {
                            name: shotInfo.shotInfo.block.name,
                            type: shotInfo.shotInfo.block.type,
                            position: vecToJSON(shotInfo.shotInfo.block.position),
                        }
                        : null,
                }
                : null,
        },
        reconstructedShot: {
            initialPos: vecToJSON(reconstructedShot.initialPos),
            initialVel: vecToJSON(reconstructedShot.initialVel),
            initialYaw: reconstructedShot.initialYaw,
            initialPitch: reconstructedShot.initialPitch,
            gravity: reconstructedShot.gravity,
            blockCheck: reconstructedShot.blockCheck,
            blockHit: reconstructedShot.blockHit,
            points: reconstructedShot.points.map(vecToJSON),
            pointVelocities: reconstructedShot.pointVelocities.map(vecToJSON),
            calcResult: {
                XZLandingDistance: reconstructedShotInfo.XZLandingDistance,
                YLandingDistance: reconstructedShotInfo.YLandingDistance,
                totalTicks: reconstructedShotInfo.totalTicks,
                blockFace: reconstructedShotInfo.blockFace ?? null,
                closestPoint: vecToJSON(reconstructedShotInfo.closestPoint),
                block: reconstructedShotInfo.block
                    ? {
                        name: reconstructedShotInfo.block.name,
                        type: reconstructedShotInfo.block.type,
                        position: vecToJSON(reconstructedShotInfo.block.position),
                    }
                    : null,
            },
        },
    };

    writeFileSync(logPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`wrote shot log to ${logPath}`);
}

function pearl(name?: string, logArg?: string) {
    const pearlTarget = bot.nearestEntity((e) => (e.username ?? e.name) === name);
    if (!pearlTarget) {
        console.log("no entity");
        return false;
    }
    const pearlBlock = bot.blockAt(pearlTarget.position.offset(0, -1, 0));
    if (!pearlBlock) {
        console.log("no block under entity");
        return false;
    }
    const face = 1;
    const logPath = resolveLogPath(logArg);
    if (logPath) {
        const shotInfo = bot.ender.shotToBlock(pearlBlock, face);
        if (!shotInfo) {
            console.log("no shot info");
            return false;
        }
        writeShotLog(logPath, pearlTarget, pearlBlock, face, shotInfo);
    }
    return bot.ender.pearl(pearlBlock, face);
}

function come(name?: string) {
    const comeTarget = bot.nearestEntity((e) => (e.username ?? e.name) === name);
    if (!comeTarget) {
        console.log("no entity");
        return;
    }
    bot.pathfinder.setGoal(new goals.GoalFollow(comeTarget, 3), true);
    // bot.util.move.followEntityWithRespectRange(comeTarget, 3);
}
