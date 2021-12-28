import { Bot } from "mineflayer";
import { Entity } from "prismarine-entity";
import { Item } from "prismarine-item";
import md from "minecraft-data";
import { performance } from "perf_hooks";
import { promisify } from "util";
import { EnderShotPlanner } from "./enderPlanner";

import { Vec3 } from "vec3";
import { BlockFace, CheckedShot } from "./types";
import { Block } from "prismarine-block";
import { EnderShotFactory } from "./enderShotFactory";
const sleep = promisify(setTimeout);
const emptyVec = new Vec3(0, 0, 0);

export class Enderman {
    public enabled: boolean = false;
    public useOffhand: boolean = false;
    // public tracker: EntityTracker;
    private lastPearl: number = performance.now();
    private pearling: boolean = false;
    private shotCharging: boolean = false;
    private planner: EnderShotPlanner;
    private shotInfo: CheckedShot | null = null;
    private waitTime: number = 1000;

    constructor(private bot: Bot) {
        this.planner = new EnderShotPlanner(bot);
    }

    private get pearlReady(): boolean {
        return performance.now() - this.lastPearl >= this.waitTime;
    }

    public shotToBlock(block: Block, face?: BlockFace) {
        return this.planner.shotToBlock(block, face);
    }

    public hasPearls(): boolean {
        return !!this.bot.util.inv.getAllItems().find((item) => item.name.includes("_pearl"));
    }

    public async equipPearls(): Promise<boolean> {
        const usedHand = this.bot.util.inv.getHandWithItem(this.useOffhand);
        if (!usedHand || !usedHand.name.includes("_pearl")) {
            const foundItem = this.bot.util.inv.getAllItems().find((item) => item.name.includes("_pearl"));
            if (!foundItem) return false;
            await this.bot.util.inv.customEquip(foundItem, this.bot.util.inv.getHand(this.useOffhand));
        }
        return true;
    }

    public cancel() {
        // if (this.target) this.tracker.stopTrackingEntity(this.target);
        this.enabled = false;
        if (this.shotCharging && this.shotInfo) this.bot.util.move.forceLook(this.shotInfo.yaw, this.shotInfo.pitch, true);
        this.bot.deactivateItem();
    }

    public async pearl(block: Block, face?: number): Promise<boolean> {
        if (this.pearling) return false;
        this.pearling = true;
        const shotInfo = this.shotToBlock(block, face);
        const equipped = await this.equipPearls();
        if (!equipped) {
            this.pearling = false;
            console.log("No pearls.");
            return false;
        }

        if (!shotInfo) {
            this.pearling = false;
            return false;
        }
        const initShot = EnderShotFactory.fromPlayer(
            { position: this.bot.entity.position, yaw: shotInfo.yaw, pitch: shotInfo.pitch, velocity: emptyVec },
            this.bot
        );
        initShot.calcToBlock(block, true);

        if (!shotInfo.hit) {
            this.pearling = false;
            console.log("Invalid shot info.");
            return false;
        }


        await this.bot.util.move.forceLook(shotInfo.yaw, shotInfo.pitch, true);
        while (!this.pearlReady) await sleep(0);
        //will update plugin in a sec

        this.bot.swingArm(undefined);
        this.bot.activateItem();
        this.bot.deactivateItem();
        this.lastPearl = performance.now();
        this.pearling = false;
        for (let i = 0; i < 3; i++) {
            for (const pos of initShot.points) {
                const { x, y, z } = pos;
                this.bot.chat(`/particle flame ${x} ${y} ${z} 0 0 0 0 1 force`);
            }
            await sleep(1000);
        }

        return true;
    }
}
