import assert from "assert";
import { AABBUtils } from "@nxg-org/mineflayer-util-plugin";
import { Vec3 } from "vec3";
import { Enderman } from "../src/enderman";
import { getTargetYaw, radiansToDegrees } from "../src/calc/mathUtils";
import { createReplayBot } from "./replayWorld";

type PlannerAccess = {
    planner: {
        getCompensatedYaw: (targetPos: Vec3) => number;
    };
};

function runShotToAABBTargetPosTest() {
    const enderman = new Enderman(createReplayBot());
    enderman.dvStep = 720;
    const plannerAccess = enderman as unknown as PlannerAccess;

    const targetPos = new Vec3(-78.0, 4.0, -38.25);
    const targetAABB = AABBUtils.getEntityAABBRaw({ position: targetPos, height: 1.8, width: 0.6 });
    const directYaw = getTargetYaw(enderman["bot"].entity.position, targetPos);
    const compensatedYaw = plannerAccess.planner.getCompensatedYaw(targetPos);

    const result = enderman.shotToAABB(targetAABB, targetPos);

    assert.ok(result, "shotToAABB should return a shot for the target position replay");
    assert.strictEqual(result.hit, true, "shotToAABB should report a hit for the target position replay");
    assert.ok(Math.abs(result.yaw - compensatedYaw) < 1e-9, "successful replay should use the compensated yaw to targetPos");

    const diagnostic = [
        "targetPos shotToAABB replay case",
        `targetYawDeg=${radiansToDegrees(directYaw).toFixed(4)}`,
        `compensatedYawDeg=${radiansToDegrees(compensatedYaw).toFixed(4)}`,
        `resultYawDeg=${radiansToDegrees(result.yaw).toFixed(4)}`,
        `resultPitchDeg=${radiansToDegrees(result.pitch).toFixed(4)}`,
        `resultTicks=${String(result.ticks)}`,
        `resultHit=${String(result.hit)}`,
        "worldModel=fake flat grass plane at y=3 with real blockAt lookups and real InterceptFunctions raycasts",
        "targetPos=-78.000,4.000,-38.250",
    ].join("\n");

    console.log(diagnostic);
}

runShotToAABBTargetPosTest();
