import { Bot } from "mineflayer";
import { performance } from "perf_hooks";
import { promisify } from "util";
import { EnderShotPlanner } from "./enderPlanner";

import { Vec3 } from "vec3";
import { BlockFace, CheckedShot } from "./types";
import { Block } from "prismarine-block";
import { EnderShotFactory } from "./enderShotFactory";
import { EnderShot } from "./enderShot";

const conv = require("mineflayer/lib/conversions.js");


const sleep = promisify(setTimeout);
const emptyVec = new Vec3(0, 0, 0);

        function deltaYawRadians (yaw1: number, yaw2: number) {
            const PI = Math.PI
            const PI_2 = Math.PI * 2
            let dYaw = (yaw1 - yaw2) % PI_2
            if (dYaw < -PI) dYaw += PI_2
            else if (dYaw > PI) dYaw -= PI_2
            return dYaw
            }


export class Enderman {
    public enabled: boolean = false;
    public useOffhand: boolean = false;
    public trailDebug: boolean = false;
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
        if (this.shotCharging && this.shotInfo) this.bot.look(this.shotInfo.yaw, this.shotInfo.pitch, true);
        this.bot.deactivateItem();
    }

    public async pearl(block: Block, face?: number): Promise<boolean> {
        if (this.pearling) return false;
        this.pearling = true;
        const shotInfo = this.shotToBlock(block, face);
        const equipped = await this.equipPearls();
        if (!equipped) {
            this.pearling = false;
            // console.log("No pearls.");
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
            // console.log("Invalid shot info.");
            return false;
        }

     
        await this.bot.look(shotInfo.yaw, shotInfo.pitch, true);

        const epsilon = 5e-3
        const lastSentYaw = () => conv.fromNotchianYaw((this.bot as any)._lastSent.yaw)
        const lastSentPitch = () => conv.fromNotchianPitch((this.bot as any)._lastSent.pitch)
        
        const epsilonEquiv = (a: number, b: number, eps: number) => Math.abs(deltaYawRadians(a, b)) < eps

        // force this to halt until we're actually looking.
        while (!this.pearlReady || !epsilonEquiv(shotInfo.yaw, lastSentYaw(), epsilon) || !epsilonEquiv(shotInfo.pitch, lastSentPitch(), epsilon)) {
            await sleep(10);
        }
        //will update plugin in a sec

        this.bot.swingArm(undefined);
        this.bot.activateItem();
        this.bot.deactivateItem();
        this.lastPearl = performance.now();
        this.pearling = false;

        if (this.trailDebug) {
            this.showTrail(initShot)
        }

        return true;
    }

    public async showTrail(initShot: EnderShot) {
        for (let i = 0; i < 3; i++) {
            for (const pos of initShot.points) {
                const { x, y, z } = pos;
                this.bot.chat(`/particle flame ${x} ${y} ${z} 0 0 0 0 1 force`);
            }
            await sleep(1000);
        }
    }
}
