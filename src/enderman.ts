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

    public async pearl(block: Block, face?: number): Promise<void> {
        if (this.pearling) return;
        this.pearling = true;
        const shotInfo = this.shotToBlock(block, face);
        const equipped = await this.equipPearls();
        if (!equipped) {
            this.pearling = false;
            return console.log("No pearls.");
        }
        if (!shotInfo || !shotInfo.hit) {
            this.pearling = false;
            return console.log("Invalid shot info.")
        };

        const task = this.bot.look(shotInfo.yaw, shotInfo.pitch);
        while (!this.pearlReady) await sleep(0);
        await task;
        // console.log(shotInfo.yaw, shotInfo.pitch, shotInfo.shotInfo?.XZLandingDistance, shotInfo.shotInfo?.closestPoint); //TODO: fix intersection here.
        this.bot.swingArm(undefined);
        this.bot.activateItem();
        this.bot.deactivateItem();
        this.lastPearl = performance.now();
        this.pearling = false;
    }
}
