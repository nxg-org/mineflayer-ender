import { Bot } from "mineflayer";
import { EnderShotFactory } from "./enderShotFactory";
import { degreesToRadians, getTargetYaw, vectorMagnitude, yawPitchAndSpeedToDir } from "./calc/mathUtils";
import { Vec3 } from "vec3";
import { AABB, InterceptFunctions } from "@nxg-org/mineflayer-util-plugin";
import { getBlockAABB, getBlockPosAABB, getEntityAABB } from "./calc/aabbUtil";
import { AABBComponents, BasicShotInfo, CheckedShot, CheckShotInfo, pitchAndTicks } from "./types";
import { Block } from "prismarine-block";

const emptyVec = new Vec3(0, 0, 0);
const dv = (steps: number) => Math.PI / steps
const PIOver2 = Math.PI / 2;
const PIOver3 = Math.PI / 3;

export class EnderShotPlanner {
    public onlyTargetBlock: boolean = true;
    private intercepter: InterceptFunctions;
    public dvSteps: number = 720;

    constructor(private bot: Bot) {
        this.intercepter = new InterceptFunctions(bot);
    }

    public get originVel(): Vec3 {
        return this.bot.entity.velocity.clone().translate(0, this.bot.entity.onGround ? -this.bot.entity.velocity.y : 0, 0)
    }

    private isShotValid(shotInfo1: CheckedShot | BasicShotInfo, face?: number) {
        let shotInfo = (shotInfo1 as CheckedShot).shotInfo;
        if (!shotInfo) shotInfo = shotInfo1 as BasicShotInfo;
        //@ts-expect-error
        if (shotInfo.shotInfo) shotInfo = shotInfo.shotInfo as BasicShotInfo;
        if (!shotInfo) return false;
        if (this.onlyTargetBlock)
            return shotInfo.XZLandingDistance === 0 && shotInfo.YLandingDistance === 0 && (!face || face === shotInfo.blockFace);
        else return shotInfo.XZLandingDistance <= 1.1413 && shotInfo.YLandingDistance === 0 && (!face || face === shotInfo.blockFace);
    }

    /**
     * Better optimization. Still about 5x more expensive than hawkeye (no clue what I did) but its more accurate so whatever.
     *
     * Note: The increased cost comes from the increased checks made (1440 vs 100). This will be fixed.
     *
     * @param target
     * @param avgSpeed
     * @param pitch
     * @returns {CheckedShot} the shot.
     */
    shotToBlock(target: Block, face?: number, pitch: number = -PIOver2): CheckedShot | null {
        const targetPos = target.position.floored();
        return this.shotToAABB(getBlockPosAABB(targetPos), targetPos, face, pitch);
    }

    shotToAABB(targetAABB: AABB, targetPos: Vec3, face?: number, pitch: number = -PIOver2): CheckedShot | null {
        const yaw = getTargetYaw(this.bot.entity.position, targetPos);
        while (pitch < PIOver2) {
            const initInfo = this.getNextAABBShot(targetAABB, targetPos, yaw, pitch);
            if (isNaN(initInfo.pitch)) {
                return null;
            }
            pitch = initInfo.pitch;
            const correctShot = this.checkForAABBIntercepts(targetAABB, targetPos, face, initInfo);
            if (correctShot.hit) return correctShot;
            const yawShot = this.getAlternativeYawAABBShots(targetAABB, targetPos, face, initInfo);
            if (this.isShotValid(yawShot, face)) return yawShot;
        }
        return null;
    }


    public checkForAABBIntercepts(targetAABB: AABB, targetPos: Vec3, face?: number, ...shots: CheckShotInfo[]): CheckedShot {
        for (const { pitch, ticks, yaw } of shots) {
            const initShot = EnderShotFactory.fromPlayer(
                { position: this.bot.entity.position, yaw, pitch, velocity: this.originVel },
                this.bot,
                this.intercepter
            );
            const shot = initShot.calcToAABB(targetAABB, targetPos, true);
            if (this.isShotValid(shot, face)) return { hit: true, yaw, pitch, ticks, shotInfo: shot };
        }
        return { hit: false, yaw: NaN, pitch: NaN, ticks: NaN, shotInfo: null };
    }

    public checkForBlockIntercepts(target: Block, face?: number, ...shots: CheckShotInfo[]): CheckedShot {
        const targetPos = target.position.floored();
        return this.checkForAABBIntercepts(getBlockPosAABB(targetPos), targetPos, face, ...shots);
    }

    public getNextShot(target: Block, yaw: number, minPitch: number = -PIOver2): CheckShotInfo {
        const targetPos = target.position.floored();
        return this.getNextAABBShot(getBlockPosAABB(targetPos), targetPos, yaw, minPitch);
    }

    public getNextAABBShot(targetAABB: AABB, targetPos: Vec3, yaw: number, minPitch: number = -PIOver2): CheckShotInfo {
        let shiftPos: boolean = true;
        let hittingData: pitchAndTicks[] = [];
        const dvS = dv(this.dvSteps);
        for (let pitch = minPitch + dvS; pitch < PIOver2; pitch += dvS) {
            if (pitch > PIOver3) shiftPos = false;
            const initShot = EnderShotFactory.fromPlayer(
                { position: this.bot.entity.position, yaw, pitch, velocity: this.originVel },
                this.bot,
                this.intercepter
            );
            const shot = initShot.calcToAABB(targetAABB, targetPos);
            if (!this.isShotValid(shot)) {
                //     continue
                // }
                // return { yaw, pitch, ticks: Math.ceil(shot.totalTicks), shift: shiftPos };
                if (hittingData.length !== 0) {
                    const avgPitch = hittingData.map((e) => e.pitch).reduce((a, b) => a + b) / hittingData.length; //monkeypatch to hit feet.
                    const avgTicks = hittingData.map((e) => e.ticks).reduce((a, b) => a + b) / hittingData.length;
                    return { yaw, pitch: avgPitch, ticks: Math.ceil(avgTicks), shift: shiftPos };
                }
            } else {
                hittingData.push({ pitch, ticks: shot.totalTicks });
            }
        }
        return { yaw: NaN, pitch: NaN, ticks: NaN };
    }

    public getAlternativeYawShots(target: Block, face?: number, ...shots: CheckShotInfo[]): CheckedShot {
        const targetPos = target.position.floored();
        return this.getAlternativeYawAABBShots(getBlockPosAABB(targetPos), targetPos, face, ...shots);
    }

    public getAlternativeYawAABBShots(targetAABB: AABB, targetPos: Vec3, face?: number, ...shots: CheckShotInfo[]): CheckedShot {
        for (const { pitch, yaw: orgYaw } of shots) {
            const yaws = targetAABB
                .toVertices()
                .map((p) => getTargetYaw(this.bot.entity.position, p))
                .sort((a, b) => (orgYaw - Math.abs(a)) - (orgYaw - Math.abs(b)));
            let inbetween = [yaws.pop()!, yaws.pop()!];
            inbetween = inbetween.map((y) => y + Math.sign(orgYaw - y) * 0.02);
            for (const yaw of inbetween) {
                const initShot = EnderShotFactory.fromPlayer(
                    { position: this.bot.entity.position, yaw, pitch, velocity: this.originVel },
                    this.bot,
                    this.intercepter
                );
                const shot = initShot.calcToAABB(targetAABB, targetPos, true);
                if (this.isShotValid(shot, face)) {
                    return { hit: true, yaw, pitch, ticks: shot.totalTicks, shotInfo: shot };
                }
            }
        }
        return { hit: false, yaw: NaN, pitch: NaN, ticks: NaN, shotInfo: null };
    }
}
