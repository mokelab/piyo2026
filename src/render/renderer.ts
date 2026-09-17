import { Application, Graphics, Particle, ParticleContainer, Texture } from "pixi.js";
import type { WorldView } from "../sim/world";

/** 弾テクスチャの基準半径。弾の radius に合わせてスケールする。 */
const TEXTURE_RADIUS = 16;

/** ワールドの状態を PixiJS で描画する。シミュレーションには一切書き込まない。 */
export class Renderer {
  private readonly bulletLayer: ParticleContainer<Particle>;
  private readonly particles: Particle[] = [];
  private readonly bulletTexture: Texture;
  private readonly player: Graphics;

  private constructor(readonly app: Application) {
    this.bulletTexture = createBulletTexture(app);
    this.bulletLayer = new ParticleContainer<Particle>({
      texture: this.bulletTexture,
      blendMode: "add",
      dynamicProperties: { position: true, vertex: true, color: true },
    });
    this.player = new Graphics()
      .circle(0, 0, 10)
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.6 })
      .circle(0, 0, 3)
      .fill(0xffffff);
    app.stage.addChild(this.bulletLayer, this.player);
  }

  static async create(parent: HTMLElement, width: number, height: number): Promise<Renderer> {
    const app = new Application();
    await app.init({
      width,
      height,
      background: 0x05060a,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });
    parent.appendChild(app.canvas);
    return new Renderer(app);
  }

  draw(world: WorldView, invincible: boolean): void {
    this.syncBullets(world);
    this.player.position.set(world.player.x, world.player.y);
    this.player.alpha = invincible && world.frame % 8 < 4 ? 0.3 : 1;
  }

  private syncBullets(world: WorldView): void {
    const { count, x, y, radius, color } = world.bullets;
    while (this.particles.length < count) {
      this.particles.push(new Particle({ texture: this.bulletTexture, anchorX: 0.5, anchorY: 0.5 }));
    }
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      p.x = x[i];
      p.y = y[i];
      p.scaleX = p.scaleY = radius[i] / TEXTURE_RADIUS * 2;
      p.tint = color[i];
    }
    const children = this.bulletLayer.particleChildren;
    if (children.length !== count) {
      children.length = count;
      for (let i = 0; i < count; i++) children[i] = this.particles[i];
      this.bulletLayer.update();
    }
  }
}

/** 白い芯＋光のにじみを持つ円形テクスチャ（tint で色付けする） */
function createBulletTexture(app: Application): Texture {
  const g = new Graphics();
  const r = TEXTURE_RADIUS;
  for (let i = 4; i >= 1; i--) {
    g.circle(0, 0, r * (0.5 + i * 0.125)).fill({ color: 0xffffff, alpha: 0.12 });
  }
  g.circle(0, 0, r * 0.45).fill(0xffffff);
  const texture = app.renderer.generateTexture({ target: g, resolution: 2 });
  g.destroy();
  return texture;
}
