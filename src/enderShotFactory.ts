import { InterceptFunctions } from "@nxg-org/mineflayer-util-plugin/lib";
import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { trajectoryInfo } from "./calc/constants";
import { vectorMagnitude, yawPitchAndSpeedToDir } from "./calc/mathUtilts";
import { EnderShot } from "./enderShot";
import { ProjectileInfo, ProjectileMotion, ShotEntity } from "./types";

const emptyVec = new Vec3(0, 0, 0);
const shotInfo = trajectoryInfo["ender_pearl"];

export class EnderShotFactory {
    static fromPlayer({ position, yaw, pitch, velocity }: ShotEntity, bot: Bot, interceptCalcs?: InterceptFunctions): EnderShot {
        const projVel = yawPitchAndSpeedToDir(yaw!, pitch!, shotInfo.v0);
        return new EnderShot(
            velocity,
            { position: position.offset(0, shotInfo.ph, 0), velocity: projVel, gravity: shotInfo.g },
            bot,
            interceptCalcs
        );
    }

    static fromEntity({ position, velocity }: ProjectileInfo, bot: Bot, interceptCalcs?: InterceptFunctions) {
        return new EnderShot(velocity, { position, velocity, gravity: shotInfo.g }, bot, interceptCalcs);
    }
}
