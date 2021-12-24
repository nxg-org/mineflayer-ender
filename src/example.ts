import { createBot } from "mineflayer";
import enderPearling from "./index";
import { Vec3 } from "vec3";
import type { Entity } from "prismarine-entity";
import type { Block } from "prismarine-block";

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
            const test = bot.ender.shotToBlock(targetBlock, 1)
            // console.log("fuck", test)
            if (!test || !test?.hit) return console.log("shit")
            const item = bot.inventory.items().find(i => i.name === "ender_pearl")
            if (!item) return console.log("no ender pearl.")
            await bot.equip(item, "hand")
            await bot.look(test.yaw, test.pitch)
            await bot.waitForTicks(1)
            console.log(test.yaw, test.pitch, test.shotInfo?.landingDistance, test.shotInfo?.closestPoint) //TODO: fix intersection here.
            bot.swingArm(undefined);
            bot.activateItem();
            bot.deactivateItem();
            break;
    }
});
