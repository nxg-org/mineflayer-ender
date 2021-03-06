import { Vec3 } from "vec3";
import type { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import type { Entity } from "prismarine-entity";
import type { Item } from "prismarine-item";
import { dirToYawAndPitch, getPremonition } from "./calc/mathUtilts";
import { trajectoryInfo, airResistance, BlockFace } from "./calc/constants";
import { getBlockAABB, getBlockPosAABB, getEntityAABB } from "./calc/aabbUtil";
import { promisify } from "util";
import { AABB, InterceptFunctions } from "@nxg-org/mineflayer-util-plugin";
import { AABBComponents, BasicShotInfo, ProjectileMotion, ShotEntity } from "./types";

const emptyVec = new Vec3(0, 0, 0);
type BlockAndIterations = {
    block: Block | null;
    iterations: Iteration[];
};
type Iteration = {
    x: number;
    y: number;
    z: number;
    face: number;
};

/**
 * TODO: Change hit detection from AABB -> Ray to AABB -> Moving AABB of 0.5h, 0.5w.
 * ! We are "missing" shots due to this miscalculation.
 * * DONE! WOOOOOOOOOO
 *
 * TODO: Completely rewrite arrow trajectory calculation. Currently using assumptions, can be much better.
 * ! It is very fast; I will have to optimize even more.
 * * DONE! WOOOOOOOOOO
 *
 * TODO: Work on caching arrow trajectories. This will speed up repeated look-ups and encourage reuse of classes to save RAM/CPU.
 *
 */

/**
 * uses:
 * (a) calculate shot based off current entities yaw and target
 * (b) calculate correct yaw and target
 * (c) better block detection
 * (d) velocity checks
 */

/**
 * Purposely left off prediction.
 * You can handle that outside of the Shot class.
 */

export class EnderShot {
    readonly initialPos: Vec3;
    readonly initialVel: Vec3;
    readonly initialYaw: number;
    readonly initialPitch: number;
    readonly gravity: number;
    public points: Vec3[];
    public pointVelocities: Vec3[];
    public blockHit = false;
    private bot: Bot;
    public interceptCalcs: InterceptFunctions;
    public blockCheck: boolean = false;

    constructor(
        originVel: Vec3,
        { position: pPos, velocity: pVel, gravity }: Required<ProjectileMotion>,
        bot: Bot,
        interceptCalcs?: InterceptFunctions
    ) {
    
        const { yaw, pitch } = dirToYawAndPitch(pVel);
        this.initialPos = pPos.clone();
        this.initialVel = pVel.clone().add(originVel);
        this.gravity = gravity;
        this.initialYaw = yaw;
        this.initialPitch = pitch;
        this.points = [];
        this.pointVelocities = [];
        this.bot = bot;
        this.interceptCalcs = interceptCalcs ?? new InterceptFunctions(bot);
    }

    public calcToBlock(target: Block | Vec3, blockChecking: boolean = false): BasicShotInfo {
        let targetPos = target instanceof Vec3 ? target : target.position;
        targetPos.floor();
        const targetAABB = getBlockPosAABB(targetPos)

        let currentVelocity = this.initialVel.clone();
        let currentPosition = this.initialPos.clone();
        let nextPosition = currentPosition.clone().add(currentVelocity);
        let nearestDistance = targetAABB.distanceTo(this.initialPos); // initial distance.
        let XZLandingDistance: number = 100000; //todo, make cleaner.
        let YLandingDistance: number = 100000;
        let closestPoint: Vec3 = currentPosition.clone();
        let blockInfo: BlockAndIterations;
        let blockHit: Block | null = null;
        let blockHitFace: BlockFace | undefined;

        let totalTicks = 0;
        const gravity: number = this.gravity //+ this.gravity * airResistance.y;
        let offsetX: number;
        let offsetY: number;
        let offsetZ: number;

        while (totalTicks < 300) {
            totalTicks++;
            offsetX = -currentVelocity.x * airResistance.h;
            offsetY = -currentVelocity.y * airResistance.y + gravity;
            offsetZ = -currentVelocity.z * airResistance.h;

            const posDistance = targetPos.distanceTo(currentPosition);
            if (nearestDistance > posDistance) {
                nearestDistance = posDistance;
                closestPoint = currentPosition.clone();
            }

            if (blockChecking) {
                blockInfo = this.interceptCalcs.check(currentPosition, nextPosition);
                if (blockInfo.block && blockInfo.block.name !== "air") {
                    blockHit = blockInfo.block;
                    blockHitFace = blockInfo.iterations[0].face; //todo, make cleaner.
                    XZLandingDistance = targetPos.xzDistanceTo(blockInfo.block.position) //todo: get block interception point.
                    YLandingDistance = Math.abs(targetPos.y - blockInfo.block.position.y)
                    if (closestPoint.distanceTo(targetPos) > blockInfo.block.position.distanceTo(targetPos)) closestPoint = blockInfo.block.position.clone()
                    break;
                }
            }

            const intersection = targetAABB.intersectsSegment(currentPosition, nextPosition);
            if (intersection) {
                blockHit = this.bot.blockAt(intersection);
               
                closestPoint = intersection.clone()
                nearestDistance = 0;
                XZLandingDistance = 0;
                YLandingDistance = 0;
                break;
            }

            // console.log(currentPosition, nextPosition, totalTicks)
            this.points.push(currentPosition.clone())
            this.pointVelocities.push(currentVelocity.clone())
            currentPosition.add(currentVelocity);
            // currentVelocity.scale(Math.fround(1 - airResistance.y)).translate(0, this.gravity, 0)
            currentVelocity.translate(offsetX, offsetY, offsetZ);
            nextPosition.add(currentVelocity);
        }

        return {
            XZLandingDistance,
            YLandingDistance,
            block: blockHit,
            blockFace: blockHitFace,
            closestPoint,
            totalTicks
        }
    }
}
