import { Application, Assets, Container, Graphics, Particle, ParticleContainer, Sprite, Texture } from "pixi.js";
import bossImageUrl from "../assets/mokera.png";
import playerImageUrl from "../assets/player.png";
import type { WorldView } from "../sim/world";

/** 弾テクスチャの基準半径。弾の radius に合わせてスケールする。 */
const TEXTURE_RADIUS = 16;
/** ボス画像の表示サイズ（論理 px） */
const BOSS_SIZE = 96;
/** 敵（子モケラ）の表示サイズ（論理 px） */
const ENEMY_SIZE = 40;
/** ぴよの塗り色。画像は白塗り＋黒線なので tint で白い部分だけ色が付く。 */
const PLAYER_COLOR = 0xffd83a;
/** 残機アイコンの表示サイズと間隔（論理 px） */
const LIFE_ICON_SIZE = 24;
const LIFE_ICON_GAP = 4;

/** ワールドの状態を PixiJS で描画する。シミュレーションには一切書き込まない。 */
export class Renderer {
  private readonly bulletLayer: ParticleContainer<Particle>;
  private readonly particles: Particle[] = [];
  private readonly bulletTexture: Texture;
  private readonly boss: Sprite;
  private readonly bossTexture: Texture;
  private readonly enemyLayer = new Container();
  private readonly enemies: Sprite[] = [];
  private readonly player: Container;
  private readonly playerSprite: Sprite;
  private readonly playerTexture: Texture;
  private readonly lifeLayer = new Container();
  private readonly lifeIcons: Sprite[] = [];

  private constructor(readonly app: Application, bossTexture: Texture, playerTexture: Texture) {
    this.bulletTexture = createBulletTexture(app);
    this.bulletLayer = new ParticleContainer<Particle>({
      texture: this.bulletTexture,
      blendMode: "add",
      dynamicProperties: { position: true, vertex: true, color: true },
    });

    this.bossTexture = bossTexture;
    this.boss = new Sprite({ texture: bossTexture, anchor: 0.5 });
    this.boss.scale.set(BOSS_SIZE / bossTexture.width);

    // ドット絵なので補間せずに拡大縮小する
    playerTexture.source.scaleMode = "nearest";
    this.playerTexture = playerTexture;
    this.playerSprite = new Sprite({ texture: playerTexture, anchor: 0.5, tint: PLAYER_COLOR });
    // 当たり判定は見た目より小さいので、中心に判定点を重ねて表示する
    const hitbox = new Graphics()
      .circle(0, 0, 4)
      .fill(0xffffff)
      .stroke({ width: 1.5, color: 0xff3355 });
    this.player = new Container({ children: [this.playerSprite, hitbox] });

    app.stage.addChild(this.boss, this.enemyLayer, this.bulletLayer, this.player, this.lifeLayer);
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
    const [bossTexture, playerTexture] = await Promise.all([
      Assets.load<Texture>(bossImageUrl),
      Assets.load<Texture>(playerImageUrl),
    ]);
    return new Renderer(app, bossTexture, playerTexture);
  }

  draw(world: WorldView): void {
    this.syncBullets(world);
    this.boss.position.set(world.boss.x, world.boss.y);
    this.syncEnemies(world);
    this.player.position.set(world.player.x, world.player.y);
    this.playerSprite.alpha = world.stats.invincible > 0 && world.frame % 8 < 4 ? 0.3 : 1;
    this.syncLives(world);
  }

  /** 左下に最初の残機の数だけぴよを並べ、失った分は暗くする（残機無制限なら出さない） */
  private syncLives(world: WorldView): void {
    const { maxLives, lives } = world.stats;
    if (!Number.isFinite(maxLives)) {
      this.lifeLayer.visible = false;
      return;
    }
    this.lifeLayer.visible = true;
    while (this.lifeIcons.length < maxLives) {
      const i = this.lifeIcons.length;
      const icon = new Sprite({ texture: this.playerTexture, anchor: 0.5, tint: PLAYER_COLOR });
      icon.scale.set(LIFE_ICON_SIZE / this.playerTexture.width);
      icon.position.set(
        LIFE_ICON_GAP + LIFE_ICON_SIZE / 2 + i * (LIFE_ICON_SIZE + LIFE_ICON_GAP),
        world.height - LIFE_ICON_GAP - LIFE_ICON_SIZE / 2,
      );
      this.lifeIcons.push(icon);
      this.lifeLayer.addChild(icon);
    }
    for (let i = 0; i < this.lifeIcons.length; i++) {
      this.lifeIcons[i].alpha = i < lives ? 1 : 0.2;
    }
  }

  private syncEnemies(world: WorldView): void {
    const { enemies } = world;
    while (this.enemies.length < enemies.length) {
      const sprite = new Sprite({ texture: this.bossTexture, anchor: 0.5 });
      sprite.scale.set(ENEMY_SIZE / this.bossTexture.width);
      this.enemies.push(sprite);
      this.enemyLayer.addChild(sprite);
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const sprite = this.enemies[i];
      sprite.visible = i < enemies.length;
      if (sprite.visible) sprite.position.set(enemies[i].x, enemies[i].y);
    }
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
