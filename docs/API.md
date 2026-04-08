# API

This page documents the current public surface of `@nxg-org/mineflayer-ender`.

## Installation

```bash
npm install @nxg-org/mineflayer-ender
```

## Plugin Setup

```ts
import { createBot } from "mineflayer";
import enderPlugin from "@nxg-org/mineflayer-ender";

const bot = createBot({
  host: "localhost",
  username: "ender-bot"
});

bot.loadPlugin(enderPlugin);
```

When the plugin loads, it augments Mineflayer with:

```ts
bot.ender: Enderman
```

If `bot.util` is missing, the plugin automatically loads `@nxg-org/mineflayer-util-plugin`.

## Exports

### Default Export

```ts
import enderPlugin from "@nxg-org/mineflayer-ender";
```

Mineflayer plugin loader that attaches `bot.ender`.

### Named Exports

```ts
import { Enderman, EnderShotFactory } from "@nxg-org/mineflayer-ender";
```

- `Enderman`: main runtime helper attached to the bot
- `EnderShotFactory`: lower-level shot simulator constructor for custom projectile work

## Bot Augmentation

The plugin declares:

```ts
declare module "mineflayer" {
  interface Bot {
    ender: Enderman;
  }
}
```

It also declares several bot events in the module augmentation, but the current plugin implementation shown in this repository does not emit those events itself.

## `Enderman` Class

This is the primary class most users will interact with.

## Properties

### `enabled: boolean`

General runtime flag used by the class. Defaults to `false`.

### `useOffhand: boolean`

Controls whether pearl equip/usage should target the off-hand. Defaults to `false`.

## Methods

### `shotToBlock(block: Block, face?: BlockFace): CheckedShot | null`

Calculates a candidate pearl shot to the target block using the internal planner.

```ts
const shot = bot.ender.shotToBlock(block);
if (shot?.hit) {
  console.log(shot.yaw, shot.pitch, shot.ticks);
}
```

Returns:

- `CheckedShot` when planning succeeds
- `null` when no viable shot is found

### `shotToAABB(targetAABB: AABB, targetPos: Vec3, face?: BlockFace): CheckedShot | null`

Calculates a candidate pearl shot to an arbitrary world-space AABB.

```ts
const shot = bot.ender.shotToAABB(targetAABB, targetPos);
if (shot?.hit) {
  console.log(shot.yaw, shot.pitch, shot.ticks);
}
```

Notes:

- `targetAABB` should be in world coordinates.
- `targetPos` should be a representative point for that same target area (used by planner heuristics).

### `hasPearls(): boolean`

Checks whether the bot has any item whose name includes `"_pearl"` in inventory.

```ts
if (!bot.ender.hasPearls()) {
  console.log("Need more pearls");
}
```

### `equipPearls(): Promise<boolean>`

Ensures an ender pearl is equipped in the currently selected hand.

Behavior:

- returns `true` if pearls are already equipped
- returns `true` after equipping a pearl from inventory
- returns `false` if no pearls are found

### `cancel(): void`

Stops the current ender action state and deactivates the held item.

If a shot is mid-charge and internal shot info exists, it also forces the bot to look back toward that stored shot direction before cancelling.

### `pearlAABB(target: AABB, tPos: Vec3, face?: number): Promise<boolean>`

Main high-level method for throwing a pearl at an arbitrary world-space AABB.

```ts
const success = await bot.ender.pearlAABB(targetAABB, targetPos, 1);
```

Behavior:

- rejects concurrent pearl actions
- computes a valid shot using the planner
- equips pearls if needed
- force-looks to the computed yaw and pitch
- waits for an internal pearl cooldown gate
- waits for sent-look alignment using Mineflayer's `move` event tracking
- swings and activates the held item to throw the pearl

Returns `false` when:

- a pearl throw is already in progress
- no pearls are available
- no valid shot is found
- shot validation fails

Returns `true` after the throw sequence is triggered.

### `pearl(block: Block, face?: number): Promise<boolean>`

Convenience wrapper over `pearlAABB(...)` for block targets.

```ts
const success = await bot.ender.pearl(targetBlock, 1);
```

## `EnderShotFactory`

Static helper class for constructing `EnderShot` instances.

### `EnderShotFactory.fromPlayer(shotEntity, bot, interceptCalcs?): EnderShot`

Builds an `EnderShot` from a player's position, yaw, pitch, and velocity.

```ts
const shot = EnderShotFactory.fromPlayer(
  {
    position: bot.entity.position,
    yaw: 0,
    pitch: -Math.PI / 4,
    velocity: bot.entity.velocity
  },
  bot
);
```

Useful when you want to simulate a potential pearl shot before using `bot.ender.pearl()`.

### `EnderShotFactory.fromEntity(projectileInfo, bot, interceptCalcs?): EnderShot`

Builds an `EnderShot` from an existing projectile-like position and velocity.

This is a lower-level helper for custom simulations.

## `EnderShot`

`EnderShot` is not re-exported from `src/index.ts`, but it is part of the internal API surface used by the factory. It stores simulated trajectory points and can evaluate collisions against world-space AABBs or block targets.

### Important Properties

- `initialPos: Vec3`
- `initialVel: Vec3`
- `initialYaw: number`
- `initialPitch: number`
- `gravity: number`
- `points: Vec3[]`
- `pointVelocities: Vec3[]`
- `blockHit: boolean`
- `blockCheck: boolean`

### `calcToAABB(targetAABB: AABB, targetPos: Vec3, blockChecking = false): BasicShotInfo`

Simulates a projectile trajectory until it intersects the target AABB or collides with another block.

### `calcToBlock(target: Block, blockChecking = false): BasicShotInfo`

Convenience wrapper for block targets. Internally builds a block AABB and calls `calcToAABB(...)`.

The returned `BasicShotInfo` includes:

```ts
type BasicShotInfo = {
  XZLandingDistance: number;
  YLandingDistance: number;
  block: Block | null;
  blockFace?: BlockFace;
  closestPoint: Vec3 | null;
  totalTicks: number;
};
```

This method is useful when you want detailed trajectory information, not just a simple success/fail result.

## Important Types

## `CheckedShot`

```ts
type CheckedShot = {
  hit: boolean;
  yaw: number;
  pitch: number;
  ticks: number;
  shotInfo: BasicShotInfo | null;
};
```

Returned by planner operations like `shotToBlock()` and `shotToAABB()`.

## `BlockFace`

```ts
enum BlockFace {
  UNKNOWN = -999,
  BOTTOM = 0,
  TOP = 1,
  NORTH = 2,
  SOUTH = 3,
  WEST = 4,
  EAST = 5
}
```

Useful when you want to constrain the desired face of the destination block.

## `ShotEntity`

```ts
type ShotEntity = {
  position: Vec3;
  velocity: Vec3;
  yaw?: number;
  pitch?: number;
  heldItem?: Item | null;
};
```

Used by `EnderShotFactory.fromPlayer()`.

## Example Flow

```ts
const target = bot.blockAt(player.position.offset(0, -1, 0));

if (target) {
  const plan = bot.ender.shotToBlock(target);

  if (plan?.hit) {
    await bot.ender.pearl(target, plan.shotInfo?.blockFace);
  }
}
```

```ts
const shot = bot.ender.shotToAABB(targetAABB, targetPos);
if (shot?.hit) {
  await bot.ender.pearlAABB(targetAABB, targetPos, shot.shotInfo?.blockFace);
}
```

## Caveats

- The plugin is focused on pearl trajectory planning and throw execution, not a broad teleport behavior framework
- Several internal Mineflayer event declarations in `src/index.ts` are not emitted by the implementation shown here
- `EnderShot` itself is not re-exported from the package root
- The public API is still fairly low-level compared with more polished Mineflayer movement plugins
