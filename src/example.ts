import { createBot } from "mineflayer";
import enderPearling from "./index";
import { Vec3 } from "vec3";
import type { Entity } from "prismarine-entity";
import type { Block } from "prismarine-block";
import { promisify } from "util";



const sleep = promisify(setTimeout)

let target: Entity | null = null;
let targetBlock: Block | null = null;

const bot = createBot({
    username: "ender-testing",
    host: process.argv[2] ?? "localhost",
    port: Number(process.argv[3]) ?? 25565,
});

bot.loadPlugin(enderPearling);


//lazy implementation. Will automate throwing later.

bot.on("chat", async (username, message) => {

    const split = message.split(" ");
    switch (split[0]) {
        case "pearl":
            target = bot.nearestEntity((e) => (e.username ?? e.name) === split[1]);
            if (!target) {
                console.log("no entity")
                return
            }
            targetBlock = bot.blockAt(target.position.offset(0, -1, 0))
            if (!targetBlock) {
                console.log("no block under entity")
                return
            }
            bot.ender.pearl(targetBlock, 1)
        case "come":
            target = bot.nearestEntity((e) => (e.username ?? e.name) === split[1]);
            if (!target) {
                console.log("no entity")
                return
            }
            bot.util.move.followEntityWithRespectRange(target, 3)
        case "stop":
            bot.util.move.stop()
    }
});
