<h2 align="center">mineflayer-ender</h2>
<h4 align="center">A Mineflayer plugin for ender-pearl planning and enderman-style movement helpers.</h4>

<p align="center">
  <a href="https://github.com/nxg-org/mineflayer-ender">
    <img src="https://img.shields.io/badge/github-181717?style=for-the-badge&logo=github" alt="GitHub">
  </a>
  <a href="https://www.npmjs.com/package/@nxg-org/mineflayer-ender">
    <img src="https://img.shields.io/npm/v/%40nxg-org%2Fmineflayer-ender?style=for-the-badge&logo=npm" alt="NPM">
  </a>
  <img src="https://img.shields.io/badge/license-GPL--3.0-black?style=for-the-badge" alt="License">
</p>

> [!WARNING]
> This plugin is still under active iteration. The core pearling flow works, but the API is still fairly low-level.

<h3 align="center">Why use this plugin?</h3>

-----

`mineflayer-ender` gives Mineflayer bots a reusable ender-pearl planning layer instead of forcing every project to manually calculate yaw, pitch, travel ticks, and collision checks.

It is useful when you want a bot to:

- Pearl onto a specific block
- Pearl into an arbitrary world-space AABB target
- Plan whether a pearl shot is valid before throwing
- Reuse projectile simulation logic in your own combat or movement systems
- Build more "enderman-like" movement around a clean plugin surface

<h3 align="center">Features</h3>

-----

- [X] Attach `bot.ender` to Mineflayer bots
- [X] Check whether pearls are available in inventory
- [X] Auto-equip pearls before throwing
- [X] Plan a valid pearl shot to a target block
- [X] Plan a valid pearl shot to a target AABB
- [X] Expose low-level shot simulation via `EnderShotFactory`
- [ ] Higher-level chase / combat automation
- [ ] Broader polished docs and examples

<h3 align="center">Installation</h3>

-----

```bash
npm install @nxg-org/mineflayer-ender
```

The plugin depends on `@nxg-org/mineflayer-util-plugin` and loads it automatically if your bot does not already have `bot.util`.

<h3 align="center">Quick Start</h3>

-----

```ts
import { createBot } from "mineflayer";
import enderPlugin from "@nxg-org/mineflayer-ender";

const bot = createBot({
  host: "localhost",
  port: 25565,
  username: "ender-bot"
});

bot.loadPlugin(enderPlugin);

bot.once("spawn", async () => {
  const block = bot.findBlock({
    matching: (b) => b.name !== "air",
    maxDistance: 16
  });

  if (block) {
    const success = await bot.ender.pearl(block);
    console.log("Pearl result:", success);
  }
});
```

```ts
import { AABB } from "@nxg-org/mineflayer-util-plugin";
import { Vec3 } from "vec3";

const targetPos = new Vec3(10.5, 65.5, -20.5);
const targetAABB = new AABB(10, 65, -21, 11, 66, -20);
const success = await bot.ender.pearlAABB(targetAABB, targetPos);
```

There is also a chat-driven usage example in [`example/basic.ts`](./example/basic.ts).

<h3 align="center">Usage Notes</h3>

-----

- `targetAABB` is expected to be in world coordinates (not a unit/local box).
- `targetPos` should describe the same world-space target region as `targetAABB`.
- `bot.ender.pearl(block, face?)` returns `false` when no valid shot is found or no pearls are available.
- `bot.ender.pearlAABB(targetAABB, targetPos, face?)` is the generic high-level throw API.
- `shotToBlock()` can be used to inspect a candidate shot before actually throwing.
- `shotToAABB()` can be used to inspect a candidate AABB shot before actually throwing.
- Look-send synchronization uses Mineflayer's `move` event, not private internal fields.
- Off-hand support exists on the `Enderman` instance through `useOffhand`.

<h3 align="center">API and Examples</h3>

-----

| Link | Description |
| --- | --- |
| [API](./docs/API.md) | Full API reference for the plugin, public classes, types, and method behavior. |
| [Example](./example/basic.ts) | A simple example showing pearl and follow commands. |

<h3 align="center">License</h3>

-----

This package is published as `GPL-3.0` in [`package.json`](./package.json).
