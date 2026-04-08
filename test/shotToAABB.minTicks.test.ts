import assert from "assert";
import { AABBUtils } from "@nxg-org/mineflayer-util-plugin";
import { Vec3 } from "vec3";
import { Enderman } from "../src/enderman";
import { radiansToDegrees } from "../src/calc/mathUtils";
import { createReplayBot } from "./replayWorld";

function runShotToAABBMinTicksTest() {
    const enderman = new Enderman(createReplayBot());
    enderman.dvStep = 720;

    const landingPos = new Vec3(-79.5, 4.0, -29.5);
    const landingAABB = AABBUtils.getEntityAABBRaw({ position: landingPos, height: 1.8, width: 0.6 });

    const fastestResult = enderman.shotToAABB(landingAABB, landingPos);
    const delayedResult = enderman.shotToAABB(landingAABB, landingPos, undefined, 5);

    assert.ok(fastestResult?.hit, "baseline replay should produce a valid hit");
    assert.ok(delayedResult?.hit, "minFlightTicks replay should still produce a valid hit");
    assert.ok(delayedResult.ticks >= 5, "minFlightTicks replay should meet the minimum flight duration");
    assert.ok(delayedResult.ticks >= fastestResult.ticks, "minFlightTicks replay should not choose a faster shot than baseline");
    assert.ok(delayedResult.pitch < fastestResult.pitch, "minFlightTicks replay should choose a higher pitch arc");

    const diagnostic = [
        "minFlightTicks shotToAABB replay case",
        `baselineTicks=${String(fastestResult.ticks)}`,
        `baselinePitchDeg=${radiansToDegrees(fastestResult.pitch).toFixed(4)}`,
        "requestedMinFlightTicks=5",
        `resultTicks=${String(delayedResult.ticks)}`,
        `resultPitchDeg=${radiansToDegrees(delayedResult.pitch).toFixed(4)}`,
        `resultHit=${String(delayedResult.hit)}`,
        "landingPos=-79.500,4.000,-29.500",
    ].join("\n");

    console.log(diagnostic);
}

runShotToAABBMinTicksTest();
