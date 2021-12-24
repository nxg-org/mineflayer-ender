import { InterceptFunctions } from "@nxg-org/mineflayer-util-plugin";
import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { trajectoryInfo } from "./calc/constants";
import { yawPitchAndSpeedToDir } from "./calc/mathUtilts";
import { EnderShot } from "./enderShot"
import { ProjectileMotion, ShotEntity } from "./types";

const emptyVec = new Vec3(0, 0, 0);


export class EnderShotFactory {


    static fromPlayer(
        { position, yaw, pitch, velocity, heldItem }: ShotEntity,
        bot: Bot, interceptCalcs?: InterceptFunctions
    ): EnderShot {
        const info = trajectoryInfo["ender_pearl"];
        const projVel = yawPitchAndSpeedToDir(yaw!, pitch!, info.v0);
        return new EnderShot(velocity, { position: position.offset(0, 1.62, 0), velocity: projVel, gravity: info.g }, bot, interceptCalcs);

    }
    
    static withoutGravity({ position, velocity }: ProjectileMotion, bot: Bot, interceptCalcs?: InterceptFunctions): EnderShot {
        return new EnderShot(emptyVec, { position, velocity, gravity: 0.00 }, bot, interceptCalcs);
    }

    static customGravity({ position, velocity }: ProjectileMotion, gravity: number, bot: Bot, interceptCalcs?: InterceptFunctions,): EnderShot {
        return new EnderShot(emptyVec, { position, velocity, gravity }, bot, interceptCalcs);
    }

}