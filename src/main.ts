import { aiDefinitions, findAI } from "./ai/registry";
import type { DodgeAI } from "./ai/types";
import { Renderer } from "./render/renderer";
import { demoStage } from "./sim/patterns/basic";
import { World } from "./sim/world";

const WIDTH = 480;
const HEIGHT = 640;
const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 4;

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get("seed") ?? Date.now()) >>> 0;

  const stageEl = document.getElementById("stage")!;
  const hudEl = document.getElementById("hud")!;
  const selectEl = document.getElementById("ai-select") as HTMLSelectElement;

  const world = new World({ width: WIDTH, height: HEIGHT, seed });
  world.spawn(demoStage);

  let aiDef = findAI(params.get("ai"));
  let ai: DodgeAI = aiDef.create();

  for (const def of aiDefinitions) {
    selectEl.add(new Option(def.label, def.id, false, def === aiDef));
  }
  selectEl.addEventListener("change", () => {
    aiDef = findAI(selectEl.value);
    ai = aiDef.create();
    params.set("ai", aiDef.id);
    history.replaceState(null, "", `?${params}`);
  });

  const renderer = await Renderer.create(stageEl, WIDTH, HEIGHT);
  fitStage(stageEl);
  window.addEventListener("resize", () => fitStage(stageEl));

  let accumulator = 0;
  let aiTimeMs = 0;
  renderer.app.ticker.add((ticker) => {
    accumulator = Math.min(accumulator + ticker.deltaMS, STEP_MS * MAX_STEPS_PER_FRAME);
    while (accumulator >= STEP_MS) {
      const t0 = performance.now();
      const intent = ai.decide(world);
      aiTimeMs = aiTimeMs * 0.9 + (performance.now() - t0) * 0.1;
      world.step(intent);
      accumulator -= STEP_MS;
    }
    renderer.draw(world, world.stats.invincible > 0);

    if (world.frame % 10 === 0) {
      hudEl.textContent =
        `FPS ${ticker.FPS.toFixed(0)} / bullets ${world.bullets.count} / hits ${world.stats.hits}` +
        ` / AI ${aiTimeMs.toFixed(2)}ms / seed ${seed}`;
    }
  });
}

/** 論理解像度の縦横比を保ったままウィンドウに収める */
function fitStage(el: HTMLElement): void {
  const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
  el.style.width = `${WIDTH * scale}px`;
  el.style.height = `${HEIGHT * scale}px`;
}

main();
