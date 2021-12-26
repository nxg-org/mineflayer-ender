import type { Block } from "prismarine-block";
import type { Item } from "prismarine-item";
import type { Vec3 } from "vec3";

export type ShotEntity = { position: Vec3; velocity: Vec3; yaw?: number; pitch?: number; heldItem?: Item | null };
export type AABBComponents = { position: Vec3; height: number; width?: number };
export type ProjectileMotion = { position: Vec3; velocity: Vec3; gravity?: number };
export type ProjectileInfo =  { position: Vec3; velocity: Vec3; name?: string }
export type BasicShotInfo = {
    XZLandingDistance: number;
    YLandingDistance: number;
    block: Block | null;
    blockFace?: BlockFace
    closestPoint: Vec3 | null;
    totalTicks: number;
};

export type pitchAndTicks = { pitch: number; ticks: number };
export type CheckShotInfo = { yaw: number; pitch: number; ticks: number; shift?: boolean };
export type CheckedShot = { hit: boolean; yaw: number; pitch: number; ticks: number; shotInfo: BasicShotInfo | null };

export enum BlockFace {
    UNKNOWN = -999,
    BOTTOM = 0,
    TOP = 1,
    NORTH = 2,
    SOUTH = 3,
    WEST = 4,
    EAST = 5,
}
