import { aiDefinitions, findAI } from "./ai/registry";
import { manualAI } from "./ai/manual";
import { manualInput } from "./input/manualInput";
import { TouchDrag } from "./input/touchDrag";
import type { DodgeAI } from "./ai/types";
import { Renderer } from "./render/renderer";
import { demoPatternIds, demoStageFrom, difficultyGroupIds, type StageProgress } from "./sim/patterns/basic";
import { World } from "./sim/world";

const WIDTH = 480;
const HEIGHT = 640;
const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 4;

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  // クエリパラメータ無しで開いたときはタイトル画面から始める
  const showTitle = location.search === "";
  const seed = Number(params.get("seed") ?? Date.now()) >>> 0;

  const stageEl = document.getElementById("stage")!;
  const hudEl = document.getElementById("hud")!;
  const selectEl = document.getElementById("ai-select") as HTMLSelectElement;
  const touch = new TouchDrag(document.getElementById("touch")!, manualInput, WIDTH);

  const world = new World({ width: WIDTH, height: HEIGHT, seed });
  // ?pattern=<id> で最初に流すパターンを固定する（パターン確認用）
  const startPattern = params.get("pattern");
  if (startPattern !== null && !demoPatternIds.includes(startPattern)) {
    console.warn(`unknown pattern "${startPattern}". available: ${demoPatternIds.join(", ")}`);
  }
  // ?group=<id> で最初の難易度グループを固定する（?pattern= があればそちらを優先）
  const startGroup = params.get("group");
  if (startGroup !== null && !difficultyGroupIds.includes(startGroup)) {
    console.warn(`unknown group "${startGroup}". available: ${difficultyGroupIds.join(", ")}`);
  }
  // ?loop=<n> で n 周目（1 始まり）から始める。周を重ねるほど弾が速い
  const startLoop = Number(params.get("loop") ?? 1) - 1;
  const progress: StageProgress = { loop: 0, speedScale: 1, groupId: "", index: 0, total: 0, patternId: "" };
  world.spawn(demoStageFrom({ loop: startLoop, group: startGroup, pattern: startPattern }, progress));

  let aiDef = findAI(params.get("ai"));
  let ai: DodgeAI = aiDef.create();

  const titleSelectEl = document.getElementById("title-ai-select") as HTMLSelectElement;
  const selectEls = [selectEl, titleSelectEl];
  for (const el of selectEls) {
    for (const def of aiDefinitions) {
      el.add(new Option(def.label, def.id, false, def === aiDef));
    }
  }
  // タイトル中は URL を書き換えない（Start 前に再読み込みしたらタイトルに戻れるように）
  let started = !showTitle;
  const changeAI = (id: string) => {
    aiDef = findAI(id);
    ai = aiDef.create();
    touch.enabled = aiDef === manualAI;
    for (const el of selectEls) el.value = aiDef.id;
    params.set("ai", aiDef.id);
    if (started) history.replaceState(null, "", `?${params}`);
  };
  selectEl.addEventListener("change", () => {
    changeAI(selectEl.value);
    // フォーカスが残っていると矢印キーでセレクトの値が変わってしまう
    selectEl.blur();
  });
  titleSelectEl.addEventListener("change", () => changeAI(titleSelectEl.value));
  touch.enabled = aiDef === manualAI;

  // キーボード操作（手動操作のときだけ効く）
  window.addEventListener("keydown", (e) => {
    if (aiDef !== manualAI || e.target instanceof HTMLSelectElement) return;
    manualInput.keyDown(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => manualInput.keyUp(e.code));
  window.addEventListener("blur", () => manualInput.clear());

  const renderer = await Renderer.create(stageEl, WIDTH, HEIGHT);
  fitStage(stageEl);
  window.addEventListener("resize", () => fitStage(stageEl));

  if (showTitle) {
    renderer.draw(world, false);
    await waitForStart();
    started = true;
    // 再読み込みで同じ弾幕と AI を再現できるように seed と ai を URL に残す
    params.set("seed", String(seed));
    params.set("ai", aiDef.id);
    history.replaceState(null, "", `?${params}`);
  }

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
        ` / AI ${aiTimeMs.toFixed(2)}ms / seed ${seed}\n` +
        `${progress.loop > 0 ? `loop ${progress.loop + 1} (speed x${progress.speedScale.toFixed(2)}) / ` : ""}${progress.groupId} ${progress.index + 1}/${progress.total}` +
        ` / ${progress.patternId}`;
    }
  });
}

/** タイトル画面を表示し、Start が押されるまで待つ */
function waitForStart(): Promise<void> {
  const titleEl = document.getElementById("title")!;
  const buttonEl = document.getElementById("start-button")!;
  // タイトル中は右上のセレクトを隠す（タイトル画面のセレクトで選ぶ）
  const controlsEl = document.getElementById("controls")!;
  controlsEl.hidden = true;
  titleEl.hidden = false;
  buttonEl.focus();
  return new Promise((resolve) => {
    buttonEl.addEventListener("click", () => {
      titleEl.hidden = true;
      controlsEl.hidden = false;
      resolve();
    }, { once: true });
  });
}

/** 論理解像度の縦横比を保ったままウィンドウに収める */
function fitStage(el: HTMLElement): void {
  const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
  el.style.width = `${WIDTH * scale}px`;
  el.style.height = `${HEIGHT * scale}px`;
}

main();
