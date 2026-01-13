interface Point {
  x: number;
  y: number;
}
/*
 * world
 *   --camera(logic canvas)
 *       --viewport(css canvas)
 */
class camera {
  scene: Scene;

  // 世界到相机 p_camera = viewMatrix * world
  viewMatrix: DOMMatrix = new DOMMatrix();
  // 相机到视口 p_viewport = viewportMatrix * p_camera

  viewportMatrix: DOMMatrix = new DOMMatrix();
  pressing: boolean = false;
  lastPoint: Point | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    const canvas = scene.canvas;
    this.viewMatrix = new DOMMatrix();
    const dpr = window.devicePixelRatio || 1;

    this.viewportMatrix = new DOMMatrix().scale(1 / dpr, 1 / dpr);
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointerleave', (e) => this.onPointerUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), {
      passive: false,
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  onWheel(e: WheelEvent) {
    if (!e.ctrlKey) return; // 允许浏览器默认的缩放行为
    e.preventDefault();
    // 根据 deltaY 计算平滑的缩放因子
    const scaleFactor = Math.pow(0.99, e.deltaY);

    // 获取鼠标在 camera 坐标系（物理像素）下的位置
    const cameraPoint = this.viewPortToCamera(e.offsetX, e.offsetY);
    const cameraX = cameraPoint.x;
    const cameraY = cameraPoint.y;

    // 在 camera 坐标系下以鼠标位置为中心缩放
    // newViewMatrix = T(cameraPoint) * S * T(-cameraPoint) * viewMatrix
    const translation1 = new DOMMatrix().translate(cameraX, cameraY);
    const scaling = new DOMMatrix().scale(scaleFactor, scaleFactor);
    const translation2 = new DOMMatrix().translate(-cameraX, -cameraY);

    this.viewMatrix = translation1
      .multiply(scaling)
      .multiply(translation2)
      .multiply(this.viewMatrix);

    this.scene.render();
  }
  onPointerDown(e: PointerEvent) {
    if (!e.ctrlKey) return; // 允许浏览器默认的缩放行为
    this.pressing = true;
    const cameraPoint = this.viewPortToCamera(e.offsetX, e.offsetY);
    this.lastPoint = { x: cameraPoint.x, y: cameraPoint.y };
  }
  onPointerMove(e: PointerEvent) {
    if (!e.ctrlKey) return; // 允许浏览器默认的缩放行为
    if (!this.pressing || !this.lastPoint) return;
    const cameraPoint = this.viewPortToCamera(e.offsetX, e.offsetY);
    const cameraX = cameraPoint.x;
    const cameraY = cameraPoint.y;
    const dx = cameraX - this.lastPoint.x;
    const dy = cameraY - this.lastPoint.y;
    const translation = new DOMMatrix().translate(dx, dy);
    this.viewMatrix = translation.multiply(this.viewMatrix);
    this.lastPoint = { x: cameraX, y: cameraY };
    this.scene.render();
  }
  onPointerUp(e: PointerEvent) {
    this.pressing = false;
  }

  viewportToWorld(x: number, y: number): DOMPoint {
    const invViewport = this.viewportMatrix.inverse();
    const invView = this.viewMatrix.inverse();
    const point = new DOMPoint(x, y);

    const worldPoint = point
      .matrixTransform(invViewport)
      .matrixTransform(invView);
    return worldPoint;
  }
  worldToViewport(x: number, y: number): DOMPoint {
    const point = new DOMPoint(x, y);

    const viewportPoint = point
      .matrixTransform(this.viewMatrix)
      .matrixTransform(this.viewportMatrix);
    return viewportPoint;
  }
  viewPortToCamera(x: number, y: number): DOMPoint {
    const invViewport = this.viewportMatrix.inverse();
    const point = new DOMPoint(x, y);
    const cameraPoint = point.matrixTransform(invViewport);
    return cameraPoint;
  }
}

class Sprite {
  transform: DOMMatrix = new DOMMatrix();
  image: HTMLImageElement;
  constructor(image: HTMLImageElement) {
    this.image = image;
  }
  render(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(
      this.image,
      0,
      0,
      this.image.naturalWidth,
      this.image.naturalHeight
    );
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.image.naturalWidth, this.image.naturalHeight);
  }
}

export class Scene {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: camera;
  children: Sprite[] = [];
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    this.resize();
    this.camera = new camera(this);
    this.bindEvents();
  }

  bindEvents() {
    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.ctrlKey) {
        this.canvas.style.cursor = 'grab';
        return;
      }
      const worldPoint = this.camera.viewportToWorld(e.offsetX, e.offsetY);
      const sprite = this.children[0];
      if (!sprite) return;
      const invTransform = sprite.transform.inverse();
      const localPoint = new DOMPoint(
        worldPoint.x,
        worldPoint.y
      ).matrixTransform(invTransform);

      if (
        localPoint.x >= 0 &&
        localPoint.x <= sprite.image.naturalWidth &&
        localPoint.y >= 0 &&
        localPoint.y <= sprite.image.naturalHeight
      ) {
        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = 'default';
      }
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }
  canvasCenterInWorld(): DOMPoint {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    return this.camera.viewportToWorld(centerX, centerY);
  }
  load(image: HTMLImageElement) {
    const sprite = new Sprite(image);

    // 计算缩放比例，使图片适应画布
    const s = Math.min(
      this.canvas.width / image.naturalWidth,
      this.canvas.height / image.naturalHeight,
      1
    );

    // 缩放后的图片尺寸
    const scaledWidth = image.naturalWidth * s;
    const scaledHeight = image.naturalHeight * s;

    // 计算居中偏移
    const offsetX = (this.canvas.width - scaledWidth) / 2;
    const offsetY = (this.canvas.height - scaledHeight) / 2;

    // 先平移再缩放：transform = T(offset) * S(s)
    sprite.transform = new DOMMatrix().translate(offsetX, offsetY).scale(s, s);

    this.children.push(sprite);

    this.render();
  }

  render() {
    const { ctx, canvas } = this;
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { a, b, c, d, e, f } = this.camera.viewMatrix;
    ctx.transform(a, b, c, d, e, f);

    for (const child of this.children) {
      const { a, b, c, d, e, f } = child.transform;
      ctx.save();
      ctx.transform(a, b, c, d, e, f);
      child.render(ctx);
      ctx.restore();
    }
  }
}
