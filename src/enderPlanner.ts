import { Bot } from "mineflayer";
import { EnderShotFactory } from "./enderShotFactory";
import { degreesToRadians, getTargetYaw, vectorMagnitude, yawPitchAndSpeedToDir } from "./calc/mathUtilts";
import { Vec3 } from "vec3";
import { AABB,  InterceptFunctions } from "@nxg-org/mineflayer-util-plugin";
import { getBlockAABB, getBlockPosAABB, getEntityAABB } from "./calc/aabbUtil";
import { AABBComponents, BasicShotInfo } from "./types";
import { Block } from "prismarine-block";

const emptyVec = new Vec3(0, 0, 0);
const dv = Math.PI / 2880;
const PIOver2 = Math.PI / 2;
const PIOver3 = Math.PI / 3;

type pitchAndTicks = { pitch: number; ticks: number };
type CheckShotInfo = { yaw: number; pitch: number; ticks: number; shift?: boolean };
export type CheckedShot = { hit: boolean; yaw: number; pitch: number; ticks: number; shotInfo: BasicShotInfo | null };
export class EnderShotPlanner {
    private intercepter: InterceptFunctions;
    constructor(private bot: Bot) {
        this.intercepter = new InterceptFunctions(bot);
    }

    public get originVel(): Vec3 {
        return this.bot.entity.velocity;
    }

    private isShotValid(shotInfo1: CheckedShot | BasicShotInfo, target: Block | Vec3, pitch: number, face?: number) {
        if (!(target instanceof Vec3)) {
            target = target.position
        }
        let shotInfo = (shotInfo1 as CheckedShot).shotInfo;
        if (!shotInfo) shotInfo = shotInfo1 as BasicShotInfo;
        //@ts-expect-error
        if (shotInfo.shotInfo) shotInfo = shotInfo.shotInfo as BasicShotInfo;
        if (!shotInfo) return false;
        if (shotInfo.block && pitch > PIOver3) {
            // console.log("final check", pitch, shotInfo.landingDistance, target, shotInfo.block.position, (!face || face === shotInfo.blockFace));
            return shotInfo.landingDistance <= 1 && shotInfo.block.position.y === target.y && (!face || face === shotInfo.blockFace);
        } else if (shotInfo.block) {
            // console.log("final check", pitch, shotInfo.landingDistance === 0, (!face || face === shotInfo.blockFace));
            return shotInfo.landingDistance <= 1 && shotInfo.block.position.y === target.y && (!face || face === shotInfo.blockFace);
        } else {
            return false
        }
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
    shotToBlock(target: Block | Vec3, face?: number, avgSpeed: Vec3 = emptyVec, pitch: number = -PIOver2): CheckedShot | null {
        if (target instanceof Vec3) {
            const tmp =this.bot.blockAt(target);
            if (!tmp) throw "couldn't find block."
            target = tmp;
        }
        const yaw = getTargetYaw(this.bot.entity.position, target.position);
        while (pitch < PIOver2) {
            const initInfo = this.getNextShot(target, yaw, face, pitch);
            if (isNaN(initInfo.pitch)) {
                console.log("shit...")
                return null;
            }
            pitch = initInfo.pitch;
            // if (avgSpeed.equals(emptyVec)) {
                const correctShot = this.checkForBlockIntercepts(target, initInfo);
                if (this.isShotValid(correctShot, target.position, pitch)) return correctShot;
                const yawShot = this.getAlternativeYawShots(target,face, initInfo);
                if (this.isShotValid(yawShot, target.position, pitch)) return yawShot;
            // } else {
            //     const newInfo = this.shiftTargetPositions(target.position, avgSpeed,face, initInfo);
            //     for (const i of newInfo) {
            //         const correctShot = this.checkForBlockIntercepts(i.target, ...i.info);
            //         if (!correctShot.shotInfo) continue;
            //         if (this.isShotValid(correctShot, i.target, pitch)) return correctShot;
            //         const yawShot = this.getAlternativeYawShots(i.target, face,initInfo);
            //         if (this.isShotValid(yawShot, i.target, pitch)) return yawShot;
            //     }
            // }
        }
        return null;
    }

    private shiftTargetPositions(target: Vec3, avgSpeed: Vec3, face?: number, ...shotInfo: CheckShotInfo[]) {
        const newInfo = shotInfo.map((i) => (i.shift ? target.clone().add(avgSpeed.clone().scale(Math.ceil(i.ticks) + 5)) : target)); //weird monkey patch.
        const allInfo: { target: Block | Vec3; info: CheckShotInfo[] }[] = [];
        for (const position of newInfo) {
            const yaw = getTargetYaw(this.bot.entity.position, position);
            const res = this.getAllPossibleShots(target, yaw, face);
            const info = res.map((i) => {
                return { yaw, pitch: i.pitch, ticks: i.ticks };
            });
            allInfo.push({ target: target, info });
        }
        return allInfo;
    }

    public checkForBlockIntercepts(target: Block | Vec3, ...shots: CheckShotInfo[]): CheckedShot {
        if (!(target instanceof Vec3)) target = target.position
        for (const { pitch, ticks, yaw } of shots) {
            const initShot = EnderShotFactory.fromPlayer(
                { position: this.bot.entity.position, yaw, pitch, velocity: this.originVel,  },
                this.bot, this.intercepter
            );
            const shot = initShot.calcToBlock(target, true, true);
            if (this.isShotValid(shot, target, pitch))
                return { hit: true, yaw, pitch, ticks, shotInfo: shot };
        }
        return { hit: false, yaw: NaN, pitch: NaN, ticks: NaN, shotInfo: null };
    }

    public getNextShot(target: Block, yaw: number, face?: number, minPitch: number = -PIOver2): CheckShotInfo {
        let isHitting: boolean = false;
        let initHit: boolean = false;
        let shiftPos: boolean = true;
        let hittingData: pitchAndTicks[] = [];
        for (let pitch = minPitch + dv; pitch < PIOver2; pitch += dv) {
            const initShot = EnderShotFactory.fromPlayer(
                { position: this.bot.entity.position, yaw, pitch, velocity: this.originVel },
                this.bot, this.intercepter, 
            );
            const shot = initShot.calcToBlock(target);
            // console.log(face, shot.blockFace, pitch.toFixed(4), shot.landingDistance)
            // console.log(pitch.toFixed(4), shot.landingDistance, shot.totalTicks, shot.blockFace)
            if (!this.isShotValid(shot, target, pitch)) {
                isHitting = false;
                if (hittingData.length !== 0) {
                    const avgPitch = hittingData.map((e) => e.pitch).reduce((a, b) => a + b) / hittingData.length; //monkeypatch to hit feet.
                    const avgTicks = hittingData.map((e) => e.ticks).reduce((a, b) => a + b) / hittingData.length;
                    return { yaw, pitch: avgPitch, ticks: Math.floor(avgTicks), shift: shiftPos };
                } else if (pitch > PIOver3 && shot.landingDistance <= 1 && (!face || face === shot.blockFace)) {
                    shiftPos = false;
                    hittingData.push({ pitch, ticks: shot.totalTicks });
                }
                continue;
            }
            initHit = hittingData.length === 0;
            hittingData.push({ pitch, ticks: shot.totalTicks });
            if (initHit) isHitting = true;
            if (isHitting) continue;
        }
        return { yaw: NaN, pitch: NaN, ticks: NaN };
    }

    public getAlternativeYawShots(target: Block | Vec3, face?: number, ...shots: CheckShotInfo[]): CheckedShot {
        if (!(target instanceof Vec3)) target = target.position;
        
        for (const { pitch, yaw: orgYaw } of shots) {
            const yaws = getBlockPosAABB(target)
                .toVertices()
                .map((p) => getTargetYaw(this.bot.entity.position, p))
                .sort((a, b) => orgYaw - Math.abs(a) - (orgYaw - Math.abs(b)));
            let inbetween = [yaws.pop()!, yaws.pop()!];
            inbetween = inbetween.map((y) => y + Math.sign(orgYaw - y) * 0.02);
            for (const yaw of inbetween) {
                const initShot = EnderShotFactory.fromPlayer(
                    { position: this.bot.entity.position, yaw, pitch, velocity: this.originVel,  },
                    this.bot, this.intercepter
                );
                const shot = initShot.calcToBlock(target, true);
                if (this.isShotValid(shot, target, pitch)) {
                    return { hit: true, yaw, pitch, ticks: shot.totalTicks, shotInfo: shot };
                }
            }
        }
        return { hit: false, yaw: NaN, pitch: NaN, ticks: NaN, shotInfo: null };
    }

    //TODO: This is too expensive. Will aim at offset off foot instead of calc'ing all hits and averaging.
    public getAllPossibleShots(target: Block | Vec3, yaw: number, face?: number) {
        if (target instanceof Vec3) {
            const tmp =this.bot.blockAt(target);
            if (!tmp) throw "couldn't find block."
            target = tmp;
        }
        let possibleShotData: CheckShotInfo[] = [];
        let isHitting: boolean = false;
        let initHit: boolean = false;
        let shiftPos: boolean = true;
        let hittingData: pitchAndTicks[] = [];

        for (let pitch = -PIOver2; pitch < PIOver2; pitch += dv) {
            const initShot = EnderShotFactory.fromPlayer(
                { position: this.bot.entity.position, yaw, pitch, velocity: this.originVel },
                this.bot, this.intercepter
            );
            const shot = initShot.calcToBlock(target, false);
            if (shot.block !== target || shot.blockFace !== face) {
                isHitting = false;
                if (hittingData.length !== 0) {
                    const avgPitch = hittingData.map((e) => e.pitch).reduce((a, b) => a + b) / hittingData.length; //monkeypatch to hit feet.
                    const avgTicks = hittingData.map((e) => e.ticks).reduce((a, b) => a + b) / hittingData.length;
                    possibleShotData.push({ yaw, pitch: avgPitch, ticks: Math.floor(avgTicks), shift: shiftPos });
                    hittingData = [];
                    shiftPos = true;
                } else if (pitch > PIOver3 && shot.landingDistance <= 1 && (!face || face === shot.blockFace)) {
                    // console.log(pitch, shot.nearestDistance)
                    shiftPos = false;
                    hittingData.push({ pitch, ticks: shot.totalTicks });
                    // possibleShotData.push({ yaw, pitch, ticks: shot.totalTicks, shift: true });
                }
                continue;
            }

            initHit = hittingData.length === 0;
            hittingData.push({ pitch, ticks: shot.totalTicks });
            if (initHit) isHitting = true;
            if (isHitting) continue;
        }

        // console.log(possibleShotData)
        return possibleShotData;
    }
}
