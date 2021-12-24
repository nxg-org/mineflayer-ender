import { EnderShot } from "./enderShot";
import { EnderShotFactory } from "./enderShotFactory";
import utilPlugin from "@nxg-org/mineflayer-util-plugin";
import { Bot } from "mineflayer";
import { Entity } from "prismarine-entity";
import { EnderShotPlanner } from "./enderPlanner";

declare module "mineflayer" {
    interface Bot {
        ender: EnderShotPlanner;
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
    bot.ender = new EnderShotPlanner(bot);
}

export { EnderShotFactory };
export { EnderShotPlanner };
