import { Vec3 } from "vec3";
import type { Bot } from "mineflayer";
import { Block } from "prismarine-block";
import { dirToYawAndPitch } from "./calc/mathUtils";
import { airResistance, BlockFace } from "./calc/constants";
import { getBlockPosAABB } from "./calc/aabbUtil";
import { AABB, InterceptFunctions } from "@nxg-org/mineflayer-util-plugin";
import { BasicShotInfo, BasicTrajectoryInfo, ProjectileMotion, ShotBoundsCheck, TrajectoryBoundsCheck } from "./types";

type BlockAndIterations = {
    block: Block | null;
    iterations: Iteration[];
    intersect?: {
        pos: Vec3;
        face: BlockFace;
    };
};

type Iteration = {
    x: number;
    y: number;
    z: number;
    face: number;
};

type SimulationState = {
    currentPosition: Vec3;
    currentVelocity: Vec3;
    nextPosition: Vec3;
    totalTicks: number;
    offsetX: number;
    offsetY: number;
    offsetZ: number;
    finalPoint: Vec3;
};

type BlockCollision = {
    block: Block;
    impactPoint: Vec3;
    blockFace?: BlockFace;
};

export class EnderShot {
    readonly initialPos: Vec3;
    readonly initialVel: Vec3;
    readonly initialYaw: number;
    readonly initialPitch: number;
    readonly gravity: number;
    public maxTicks = 300;
    public points: Vec3[];
    public pointVelocities: Vec3[];
    public blockHit = false;
    private bot: Bot;
    public interceptCalcs: InterceptFunctions;
    public blockCheck = false;
    public isInBounds: ShotBoundsCheck = (position, _nextPosition, _velocity, _totalTicks, targetPos) => {
        const horizontalDeltaX = targetPos.x - this.initialPos.x;
        const horizontalDeltaZ = targetPos.z - this.initialPos.z;
        const horizontalDistanceSq = horizontalDeltaX * horizontalDeltaX + horizontalDeltaZ * horizontalDeltaZ;
        if (position.y < targetPos.y - 1) return false;
        if (horizontalDistanceSq === 0) return true;

        const deltaX = position.x - this.initialPos.x;
        const deltaZ = position.z - this.initialPos.z;
        const horizontalProgress = deltaX * horizontalDeltaX + deltaZ * horizontalDeltaZ;
        return horizontalProgress <= horizontalDistanceSq;
    };

    constructor(
        originVel: Vec3,
        { position: pPos, velocity: pVel, gravity }: Required<ProjectileMotion>,
        bot: Bot,
        interceptCalcs?: InterceptFunctions,
        maxTicks = 300
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
        this.maxTicks = maxTicks;
    }

    private createSimulationState(): SimulationState {
        const currentPosition = this.initialPos.clone();
        const currentVelocity = this.initialVel.clone();
        return {
            currentPosition,
            currentVelocity,
            nextPosition: currentPosition.clone().add(currentVelocity),
            totalTicks: 0,
            offsetX: 0,
            offsetY: 0,
            offsetZ: 0,
            finalPoint: currentPosition.clone()
        };
    }

    private beginTick(state: SimulationState) {
        state.totalTicks++;
        state.offsetX = -state.currentVelocity.x * airResistance.h;
        state.offsetY = -state.currentVelocity.y * airResistance.y + this.gravity;
        state.offsetZ = -state.currentVelocity.z * airResistance.h;
    }

    private recordPoint(state: SimulationState) {
        this.points.push(state.currentPosition.clone());
        this.pointVelocities.push(state.currentVelocity.clone());
        state.finalPoint = state.currentPosition.clone();
    }

    private advanceState(state: SimulationState) {
        state.currentPosition.add(state.currentVelocity);
        state.currentVelocity.translate(state.offsetX, state.offsetY, state.offsetZ);
        state.nextPosition.add(state.currentVelocity);
    }

    private checkBlockCollision(state: SimulationState): BlockCollision | null {
        const blockInfo = this.interceptCalcs.check(state.currentPosition, state.nextPosition) as BlockAndIterations;
        if (!blockInfo.block || blockInfo.block.name === "air") return null;

        return {
            block: blockInfo.block,
            impactPoint: (blockInfo.intersect?.pos ?? blockInfo.block.position).clone(),
            blockFace: blockInfo.intersect?.face ?? blockInfo.iterations[0]?.face
        };
    }

    private simulateToTarget(targetAABB: AABB, targetPos: Vec3, blockChecking: boolean, isInBounds?: ShotBoundsCheck): BasicShotInfo {
        const boundsCheck = isInBounds ?? this.isInBounds;
        const normalizedTargetPos = targetPos.floored();
        const state = this.createSimulationState();
        let nearestDistance = targetAABB.distanceToVec(this.initialPos);
        let closestPoint = state.currentPosition.clone();
        let blockHit: Block | null = null;
        let blockHitFace: BlockFace | undefined;
        let XZLandingDistance = 100000;
        let YLandingDistance = 100000;

        while (state.totalTicks < this.maxTicks) {
            this.beginTick(state);

            const posDistance = normalizedTargetPos.distanceTo(state.currentPosition);
            if (nearestDistance > posDistance) {
                nearestDistance = posDistance;
                closestPoint = state.currentPosition.clone();
            }

            if (blockChecking) {
                const collision = this.checkBlockCollision(state);
                if (collision) {
                    blockHit = collision.block;
                    blockHitFace = collision.blockFace;
                    state.finalPoint = collision.impactPoint;
                    XZLandingDistance = normalizedTargetPos.xzDistanceTo(collision.impactPoint);
                    YLandingDistance = Math.abs(normalizedTargetPos.y - collision.impactPoint.y);
                    if (closestPoint.distanceTo(normalizedTargetPos) > collision.impactPoint.distanceTo(normalizedTargetPos)) {
                        closestPoint = collision.impactPoint.clone();
                    }
                    break;
                }
            }

            const intersection = targetAABB.intersectsSegment(state.currentPosition, state.nextPosition);
            if (intersection) {
                blockHit = this.bot.blockAt(intersection);
                blockHitFace = undefined;
                closestPoint = intersection.clone();
                state.finalPoint = intersection.clone();
                XZLandingDistance = 0;
                YLandingDistance = 0;
                break;
            }

            if (!boundsCheck(state.currentPosition, state.nextPosition, state.currentVelocity, state.totalTicks, targetPos)) {
                break;
            }

            this.recordPoint(state);
            this.advanceState(state);
        }

        return {
            XZLandingDistance,
            YLandingDistance,
            block: blockHit,
            blockFace: blockHitFace,
            closestPoint,
            totalTicks: state.totalTicks
        };
    }

    private simulateTrajectoryOnly(blockChecking: boolean, isInBounds?: TrajectoryBoundsCheck): BasicTrajectoryInfo {
        const state = this.createSimulationState();
        let blockHit: Block | null = null;
        let blockHitFace: BlockFace | undefined;

        while (state.totalTicks < this.maxTicks) {
            this.beginTick(state);

            if (blockChecking) {
                const collision = this.checkBlockCollision(state);
                if (collision) {
                    blockHit = collision.block;
                    blockHitFace = collision.blockFace;
                    state.finalPoint = collision.impactPoint;
                    break;
                }
            }

            if (isInBounds && !isInBounds(state.currentPosition, state.nextPosition, state.currentVelocity, state.totalTicks)) {
                break;
            }

            this.recordPoint(state);
            this.advanceState(state);
        }

        return {
            block: blockHit,
            blockFace: blockHitFace,
            finalPoint: state.finalPoint,
            totalTicks: state.totalTicks
        };
    }

    public calcToAABB(targetAABB: AABB, targetPos: Vec3, blockChecking = false, isInBounds?: ShotBoundsCheck): BasicShotInfo {
        return this.simulateToTarget(targetAABB, targetPos, blockChecking, isInBounds);
    }

    public calcToBlock(target: Block, blockChecking = false, isInBounds?: ShotBoundsCheck): BasicShotInfo {
        const targetPos = target.position.floored();
        return this.calcToAABB(getBlockPosAABB(targetPos), targetPos, blockChecking, isInBounds);
    }

    public calcTrajectory(blockChecking = false, isInBounds?: TrajectoryBoundsCheck): BasicTrajectoryInfo {
        return this.simulateTrajectoryOnly(blockChecking, isInBounds);
    }
}
