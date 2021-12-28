import { createBot } from "mineflayer";
import enderPearling from "./index";
import { Vec3 } from "vec3";
import utilPlugin from "@nxg-org/mineflayer-util-plugin"
import type { Entity } from "prismarine-entity";
import type { Block } from "prismarine-block";
import { promisify } from "util";

const sleep = promisify(setTimeout)

const bot = createBot({
    username: "ender-testing",
    host: process.argv[2] ?? "localhost",
    port: Number(process.argv[3]) ?? 25565,
});

bot.loadPlugin(utilPlugin)
bot.loadPlugin(enderPearling);
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
            pearl(split[1] ?? username)
            break;
        case "come":
        case "here":
            come(split[1] ?? username)
            break;
        case "stop":
        case "cease":
            bot.util.move.stop()
            break;
    }
});

function pearl(name?: string) {
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
    return bot.ender.pearl(pearlBlock, 1);
}

function come(name?: string) {
    const comeTarget = bot.nearestEntity((e) => (e.username ?? e.name) === name);
    if (!comeTarget) {
        console.log("no entity");
        return;
    }
    bot.util.move.followEntityWithRespectRange(comeTarget, 3);
}
