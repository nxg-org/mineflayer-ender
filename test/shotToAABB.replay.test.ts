import assert from "assert";
import { AABB, AABBUtils } from "@nxg-org/mineflayer-util-plugin";
import { Vec3 } from "vec3";
import { Enderman } from "../src/enderman";
import { getTargetYaw, radiansToDegrees } from "../src/calc/mathUtils";
import { createReplayBot } from "./replayWorld";

type PlannerAccess = {
    planner: {
        dvSteps: number;
        getCompensatedYaw: (targetPos: Vec3) => number;
        getNextAABBShot: (targetAABB: AABB, targetPos: Vec3, yaw: number, minPitch?: number) => {
            yaw: number;
            pitch: number;
            ticks: number;
            shift?: boolean;
        };
        checkForAABBIntercepts: (targetAABB: AABB, targetPos: Vec3, face?: number, ...shots: Array<{ yaw: number; pitch: number; ticks: number }>) => {
            hit: boolean;
            yaw: number;
            pitch: number;
            ticks: number;
            shotInfo: unknown;
        };
    };
};

function runShotToAABBReplayTest() {
    const enderman = new Enderman(createReplayBot());
    enderman.dvStep = 720;
    const plannerAccess = enderman as unknown as PlannerAccess;

    const landingPos = new Vec3(-79.5, 4.0, -29.5);
    const landingAABB = AABBUtils.getEntityAABBRaw({ position: landingPos, height: 1.8, width: 0.6 });
    const tracedBaseYaw = 2.0196766138873246;

    const landingYaw = getTargetYaw(enderman["bot"].entity.position, landingPos);
    const compensatedYaw = plannerAccess.planner.getCompensatedYaw(landingPos);
    const compensatedCandidate = plannerAccess.planner.getNextAABBShot(landingAABB, landingPos, compensatedYaw);
    const compensatedResult = plannerAccess.planner.checkForAABBIntercepts(landingAABB, landingPos, undefined, compensatedCandidate);
    const result = enderman.shotToAABB(landingAABB, landingPos);

    assert.ok(Math.abs(tracedBaseYaw - landingYaw) < 1e-4, "trace yaw should match the intended landing yaw");
    assert.ok(Math.abs(compensatedYaw - landingYaw) > 0.05, "compensated yaw should differ materially from the uncompensated landing yaw");
    assert.ok(!Number.isNaN(compensatedCandidate.pitch), "compensated yaw should produce a valid candidate pitch");
    assert.strictEqual(compensatedResult.hit, true, "compensated yaw should produce a direct hit");
    assert.ok(result, "shotToAABB should find a shot for the intended landing position replay");
    assert.strictEqual(result.hit, true, "landing position replay should now succeed");

    const diagnostic = [
        "landingPos shotToAABB replay case",
        `tracedBaseYawDeg=${radiansToDegrees(tracedBaseYaw).toFixed(4)}`,
        `landingYawDeg=${radiansToDegrees(landingYaw).toFixed(4)}`,
        `compensatedYawDeg=${radiansToDegrees(compensatedYaw).toFixed(4)}`,
        `compensatedPitchDeg=${radiansToDegrees(compensatedCandidate.pitch).toFixed(4)}`,
        `resultYawDeg=${radiansToDegrees(result.yaw).toFixed(4)}`,
        `resultPitchDeg=${radiansToDegrees(result.pitch).toFixed(4)}`,
        `resultTicks=${String(result.ticks)}`,
        `resultHit=${String(result.hit)}`,
        "worldModel=fake flat grass plane at y=3 with real blockAt lookups and real InterceptFunctions raycasts",
        "landingPos=-79.500,4.000,-29.500",
        "whyItWorked=shotToAABB now compensates its initial yaw for the bot's carried horizontal velocity before searching pitch",
    ].join("\n");

    console.log(diagnostic);
}

runShotToAABBReplayTest();
