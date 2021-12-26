import { EnderShot } from "./enderShot";
import { EnderShotFactory } from "./enderShotFactory";
import utilPlugin from "@nxg-org/mineflayer-util-plugin";
import { Bot } from "mineflayer";
import { Entity } from "prismarine-entity";
import { Enderman } from "./enderman";

declare module "mineflayer" {
    interface Bot {
        ender: Enderman;
    }
    interface BotEvents {
        attackedTarget: (target: Entity) => void;
        stoppedAttacking: () => void;
        startedAttacking: (target: Entity) => void;
        targetBlockingUpdate: (target: Entity, blocking: boolean) => void;
    }
}

export default function plugin(bot: Bot) {
    if (!bot.util) bot.loadPlugin(utilPlugin);
    bot.ender = new Enderman(bot);
}

export { EnderShotFactory };
export { Enderman };
