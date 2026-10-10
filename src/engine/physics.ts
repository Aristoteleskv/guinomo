// Capsule-vs-mesh collision + floor/jump logic. Port of the original
// `collisionPhysics`/`collider` classes (three-mesh-bvh accelerated).
// The collider mesh's BVH is built in a worker (see bvh-worker.ts).

import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Line3,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Sphere,
  Spherical,
  Vector3,
} from 'three';
import { MeshBVH, MeshBVHVisualizer, acceleratedRaycast } from 'three-mesh-bvh';
import type { CharacterLocal } from './characters';
import { lerp, lerpCoefFPS, lerpFPS, getShortestRotationAngle, ratioFPS, frictionFPS, HALF_PI } from '../core/math';
import { clock } from './clock';
import { quaternionFromSpherical } from './quaternion';
import BvhWorker from './bvh-worker?worker';

export class Collider extends Mesh {}
Collider.prototype.raycast = acceleratedRaycast;

export interface CollisionOptions {
  colliderMesh: Mesh;
  substeps?: number;
  positionForce?: number;
  jumpForce?: number;
  gravity?: number;
  damp?: number;
  directionLerp?: number;
  rotVelocityMin?: number;
  rotVelocityMax?: number;
  canFly?: boolean;
  checkFalling?: boolean;
  radiusPercentage?: number;
  floorDetectInclination?: number;
  /** Declive máximo (razão vertical/horizontal da resposta à colisão) que ainda
   *  conta como chão no teste por deslocamento. 1.0 ≈ 45°. */
  slopeInclination?: number;
  fallLimitDistance?: number;
  onCollisionsReady?: () => void;
}

const BASE_DOWN = new Vector3(0, -1, 0);

export class CollisionPhysics {
  readonly charactersCapsule: { radius: number; segment: Line3 };
  readonly rayCaster = new Raycaster();
  readonly collider: Collider | null = null;
  isMoving = false;
  canFly: boolean;
  nearestVerticalPoint = -1;

  /** Character bounding sphere; its center is offset per remote when
   *  testing visibility against the camera frustum. */
  readonly boundingSphere = new Sphere();
  readonly boundingSphereCenter = new Vector3();
  readonly boundingSphereOriginalCenter = new Vector3();

  get boundsTree() {
    return (this._geometry as any)?.boundsTree;
  }
  get geometry() {
    return this._geometry;
  }

  private _characters: { _localObject: CharacterLocal; _camera: { spherical: Spherical } };
  private _camera: { spherical: Spherical };
  private _colliderMesh: Mesh;
  private _substeps: number;
  private _positionForce: number;
  private _jumpForce: number;
  private _gravity: number;
  private _charDamp: number;
  private _directionLerp: number;
  private _rotVelocityMin: number;
  private _rotVelocityMax: number;
  private _checkFalling: boolean;
  private _floorDetectInclination: number;
  private _slopeInclination: number;
  private _fallLimitDistance: number;
  private _geometry: BufferGeometry | null = null;
  private _prevIsOnFloor: boolean;
  private _prevIsOnFloorTime = -1;

  private _v0 = new Vector3();
  private _v1 = new Vector3();
  private _v2 = new Vector3();
  private _s0 = new Spherical();
  private _l0 = new Line3();
  private _l1 = new Line3();
  private _b = new Box3();
  private _bvhVisualizer: MeshBVHVisualizer | null = null;
  private _bvhGroup: Group | null = null;

  constructor(characters: { _localObject: CharacterLocal; _camera: { spherical: Spherical } }, options: CollisionOptions) {
    this._characters = characters;
    this._camera = characters._camera;
    this._colliderMesh = options.colliderMesh;
    this._colliderMesh.geometry.computeBoundingSphere();
    this._substeps = options.substeps ?? 4;
    this._positionForce = options.positionForce ?? 0.0045;
    this._jumpForce = options.jumpForce ?? 0.2;
    this._gravity = options.gravity ?? -0.009832;
    this._charDamp = options.damp ?? 0.92;
    this._directionLerp = options.directionLerp ?? 0.075;
    this._rotVelocityMin = options.rotVelocityMin ?? 0.0035;
    this._rotVelocityMax = options.rotVelocityMax ?? 0.02;
    this.canFly = options.canFly === true;
    this._checkFalling = options.checkFalling !== false;
    this._floorDetectInclination = Math.min(1, options.floorDetectInclination ?? 0.7);
    this._slopeInclination = options.slopeInclination ?? 1;
    this._fallLimitDistance = Math.min(1, options.fallLimitDistance ?? 10);
    this._prevIsOnFloor = this._characters._localObject.isOnFloor;

    const local = this._characters._localObject;
    const geo = (local.mesh as any).geometry;
    if (geo.boundingSphere) {
      this.boundingSphere.copy(geo.boundingSphere);
      this.boundingSphereCenter.copy(this.boundingSphere.center);
      this.boundingSphereOriginalCenter.copy(this.boundingSphere.center);
    }
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const charHeight = Math.abs(geo.boundingBox!.max.y - geo.boundingBox!.min.y);
    const radius = charHeight * Math.min(options.radiusPercentage ?? 0.2, 0.45);
    const segmentLength = charHeight - radius * 2;
    this.charactersCapsule = {
      radius,
      segment: new Line3(new Vector3(), new Vector3(0, segmentLength, 0)),
    };
    this.rayCaster.firstHitOnly = true;
    this._initializeGeometry(options);
  }

  private _shapecastFuncs = {
    intersectsBounds: (box: Box3) => box.intersectsBox(this._b),
    intersectsTriangle: (tri: any) => {
      const d = this._v0;
      const u = this._v1;
      const dist = tri.closestPointToSegment(this._l0, d, u);
      if (dist < this.charactersCapsule.radius) {
        const isStart = u.equals(this._l0.start);
        const depth = this.charactersCapsule.radius - dist;
        const dir = u.sub(d).normalize();
        this._l0.start.addScaledVector(dir, depth);
        this._l0.end.addScaledVector(dir, depth);
        if (isStart && dir.y > 0) {
          tri.getNormal(this._v2);
          if (this._v2.y > this._floorDetectInclination) {
            this._characters._localObject.isOnFloor = true;
          }
        }
      }
      return false;
    },
  };

  private _initializeGeometry(options: CollisionOptions) {
    const mesh = this._colliderMesh;
    mesh.updateMatrixWorld(true);

    let settled = false;
    // A construção na main thread é adiada para um microtask: `onCollisionsReady`
    // tem de disparar de forma assíncrona (como acontecia com o worker), senão é
    // invocado durante o construtor de CollisionPhysics — antes de
    // `Characters._collisionPhysics` ser atribuído — e `_setInitialPosition`
    // falhava a ler `.collider`.
    const buildHere = () => {
      if (settled) return;
      settled = true;
      queueMicrotask(() => this._buildBoundsTreeOnMainThread(options));
    };

    // Os workers têm de ser same-origin com a página. Em desenvolvimento com a
    // página servida pelo PHP (porta 8081) e os módulos pelo Vite (porta 5173),
    // o URL do worker pertence a outra origem: com `server.origin` o construtor
    // lança SecurityError e sem ele o URL relativo dá 404 na 8081. Detectamos a
    // origem cruzada e construímos o BVH aqui mesmo (sem nunca criar o worker),
    // caso contrário o collider nunca ficaria pronto e o mundo aparecia preto.
    const moduleOrigin = new URL(import.meta.url).origin;
    if (moduleOrigin !== window.location.origin) {
      buildHere();
      return;
    }

    let worker: Worker;
    try {
      worker = new BvhWorker();
    } catch {
      // Safety net: se a construção do worker falhar, o mundo não pode ficar
      // bloqueado — construímos o BVH na main thread.
      buildHere();
      return;
    }

    worker.onmessage = (e: MessageEvent) => {
      if (settled) return;
      settled = true;
      const { serialized, position } = e.data;
      this._geometry = new BufferGeometry();
      this._geometry.setAttribute('position', new BufferAttribute(position, 3));
      if (mesh.geometry.index) {
        this._geometry.setIndex(new BufferAttribute(serialized.index, 1));
      }
      this._geometry.computeBoundingBox();
      this._geometry.boundsTree = MeshBVH.deserialize(serialized, this._geometry, { setIndex: false });
      (this as any).collider = new Collider(this._geometry);
      worker.terminate();
      this._maybeEnableBvhDebug();
      options.onCollisionsReady?.();
    };
    // Se o worker não carregar (por exemplo, um 404 do URL relativo em dev),
    // não bloqueamos o arranque do mundo: construímos o BVH na main thread.
    worker.onerror = () => {
      worker.terminate();
      buildHere();
    };

    const position = (mesh.geometry.attributes.position.array as Float32Array).slice();
    const sourceIndex = mesh.geometry.index?.array as Uint16Array | Uint32Array | undefined;
    const index = sourceIndex ? new Uint32Array(sourceIndex) : null;
    worker.postMessage(
      {
        position: position.buffer,
        index: index?.buffer ?? null,
        matrixWorld: mesh.matrixWorld.elements,
      },
      [position.buffer, ...(index ? [index.buffer] : [])],
    );
  }

  /** Builds the collider BVH synchronously. Mirrors `bvh-worker.ts` (world
   *  space transform + `MeshBVH`) and is used as a fallback whenever the
   *  worker cannot run, so the world always finishes loading. */
  private _buildBoundsTreeOnMainThread(options: CollisionOptions) {
    const mesh = this._colliderMesh;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute((mesh.geometry.attributes.position.array as Float32Array).slice(), 3),
    );
    if (mesh.geometry.index) {
      geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.geometry.index.array), 1));
    }
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    geometry.boundsTree = new MeshBVH(geometry);
    this._geometry = geometry;
    (this as any).collider = new Collider(geometry);
    this._maybeEnableBvhDebug();
    options.onCollisionsReady?.();
  }

  /** Advance the character one physics frame. `move` is the input vector. */
  update(move: Vector3, frameLerp: number) {
    const local = this._characters._localObject;
    this.isMoving = move.length() > 1e-5;

    if (this.isMoving) {
      move.multiplyScalar(this._positionForce);
      this._s0.setFromVector3(move);
      this._s0.theta += this._camera.spherical.theta;
      if (this.canFly) {
        if (move.z > 0) this._s0.phi += this._camera.spherical.phi - HALF_PI;
        else if (move.z < 0) this._s0.phi -= this._camera.spherical.phi - HALF_PI;
      }
      local.acceleration.setFromSpherical(this._s0).negate();
      const u = lerpCoefFPS(this._directionLerp);
      local.targetSpherical.theta = lerp(
        local.targetSpherical.theta,
        getShortestRotationAngle(local.spherical.theta, this._s0.theta),
        u,
      );
      local.targetSpherical.phi = lerp(
        local.targetSpherical.phi,
        getShortestRotationAngle(local.spherical.phi, this._s0.phi),
        u,
      );
    }

    if (!local.isOnFloor) local.acceleration.y += this._gravity;
    local.spherical.theta = lerp(local.spherical.theta, local.targetSpherical.theta, frameLerp);
    local.spherical.phi = lerp(local.spherical.phi, local.targetSpherical.phi, frameLerp);
    quaternionFromSpherical(local.spherical, local.quaternion);

    const ratio = ratioFPS();
    local.velocity.add(local.acceleration.multiplyScalar(ratio));
    const steps = Math.max(Math.round(ratio * this._substeps), 3);
    local.velocity.clampLength(0, steps * this.charactersCapsule.radius * 0.9);
    local.isOnFloor = false;

    for (let i = 0; i < steps; i++) this._substep(ratio / steps);

    local.velocity.multiplyScalar(frictionFPS(this._charDamp));
    local.velocityHorizontal = this._v0.copy(local.velocity).setY(0).length();
    local.acceleration.setScalar(0);

    if (local.velocityHorizontal > this._rotVelocityMin) {
      this._s0.setFromVector3(this._v0);
      local.targetSpherical.theta = lerpFPS(
        local.targetSpherical.theta,
        getShortestRotationAngle(
          local.targetSpherical.theta,
          this._s0.theta + Math.PI,
        ),
        this._directionLerp *
          Math.min(1, Math.max(0, (local.velocityHorizontal - this._rotVelocityMin) / (this._rotVelocityMax - this._rotVelocityMin))),
      );
    }

    this.rayCaster.set(
      this._v0.copy(local.position).add(this._v1.set(0, 0.001, 0)),
      BASE_DOWN,
    );
    const hit = this.rayCaster.intersectObject(this.collider as Mesh)[0];
    const offGround = !hit || hit.distance > 0.2;
    this._detectJump(local, offGround);
    this._updateNearestVerticalPoint(hit);

    if (this._checkFalling && this._geometry) {
      if (local.position.y + this._fallLimitDistance < this._geometry.boundingBox!.min.y) {
        (this._characters as any).snap(local.initialPosition.toArray());
      }
    }
  }

  private _substep(dt: number) {
    const local = this._characters._localObject;
    this._v0.copy(local.velocity).multiplyScalar(dt);
    local.position.add(this._v0);
    local.updateMatrix();

    this._l0.copy(this.charactersCapsule.segment);
    this._l0.start.y += this.charactersCapsule.radius;
    this._l0.end.y += this.charactersCapsule.radius;
    local.updateMatrix();
    this._l0.start.applyMatrix4(local.matrix);
    this._l0.end.applyMatrix4(local.matrix);
    this._l1.copy(this._l0);
    this._b.makeEmpty();
    this._b.expandByPoint(this._l0.start);
    this._b.expandByPoint(this._l0.end);
    this._b.min.addScalar(-this.charactersCapsule.radius);
    this._b.max.addScalar(this.charactersCapsule.radius);
    (this._geometry as any)!.boundsTree.shapecast(this._shapecastFuncs);

    const correction = this._v0;
    correction.subVectors(this._l0.start, this._l1.start);
    const len = Math.max(0, correction.length() - 1e-5 * dt);
    // Grounding por deslocamento (portado do metaverso original, `enableBVHCharacter`
    // + `PhysicsUpdate`): além do teste do normal no fundo do cápsula (`intersectsTriangle`),
    // o chão também é detetado quando a resposta à colisão empurra para cima acima de um
    // declive mínimo. Apanha degraus, arestas e corrimões, onde o ponto de contacto é uma
    // face lateral (normal.y ≈ 0) e o teste do normal não dispara.
    if (!local.isOnFloor && len > 0 && correction.y > 0) {
      const horizontal = Math.abs(correction.x) + Math.abs(correction.z);
      if (correction.y / (horizontal + 1e-5) > this._slopeInclination) {
        local.isOnFloor = true;
      }
    }
    correction.normalize();
    local.position.addScaledVector(correction, len);
    local.velocity.addScaledVector(correction, -correction.dot(local.velocity));
  }

  private _detectJump(local: CharacterLocal, offGround: boolean) {
    if (this._prevIsOnFloor !== local.isOnFloor) {
      if (!this._prevIsOnFloor) {
        this._prevIsOnFloor = true;
        local.userData.a = 0;
      } else {
        const t = clock.time;
        if (this._prevIsOnFloorTime === -1) {
          this._prevIsOnFloorTime = t;
        } else if (t - this._prevIsOnFloorTime > 0.045 && offGround) {
          this._prevIsOnFloor = false;
          this._prevIsOnFloorTime = -1;
          local.userData.a = 1;
        }
      }
    } else {
      this._prevIsOnFloorTime = -1;
    }
    if (!this._prevIsOnFloor) {
      if (!offGround && local.userData.a === 1) local.userData.a = 0;
      if (offGround && local.userData.a === 0) local.userData.a = 1;
    }
    if (local.jumpRequested && local.isOnFloor) {
      local.jumpRequested = false;
      local.velocity.y += this._jumpForce;
    }
  }

  private _updateNearestVerticalPoint(hit: any) {
    if (!hit) {
      this.nearestVerticalPoint = -1;
      return;
    }
    const positions = this._colliderMesh.geometry.attributes.position;
    const a = this._v0.fromBufferAttribute(positions, hit.face.a).distanceToSquared(hit.point);
    const b = this._v1.fromBufferAttribute(positions, hit.face.b).distanceToSquared(hit.point);
    const c = this._v2.fromBufferAttribute(positions, hit.face.c).distanceToSquared(hit.point);
    let closest = hit.face.a;
    if (b < a && b < c) closest = hit.face.b;
    if (c < a && c < b) closest = hit.face.c;
    this.nearestVerticalPoint = closest;
  }

  private _maybeEnableBvhDebug() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('debug')) return;
    const val = params.get('debug');
    if (val !== 'bvh' && val !== 'collider') return;
    if (!this._geometry || !(this._geometry as any).boundsTree) return;

    const scene = this._characters as unknown as { scene?: { add: (obj: unknown) => void } };
    const root = scene.scene;
    if (!root) return;

    try {
      this._bvhVisualizer = new MeshBVHVisualizer((this.collider as unknown as Mesh) ?? this._colliderMesh, 20);
      (this._bvhVisualizer as any).displayParents = false;
      (this._bvhVisualizer as any).displayEdges = true;
      (this._bvhVisualizer as any).opacity = 0.15;
      (this._bvhVisualizer as any).edgeMaterial = new LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.4 });
      (this._bvhVisualizer as any).meshMaterial = new MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.05 });
      this._bvhVisualizer.update();
      this._bvhGroup = new Group();
      this._bvhGroup.add(this._bvhVisualizer);
      root.add(this._bvhGroup);
      (scene as any).beforeRenderCbs?.push?.(() => {
        if (this._bvhVisualizer) this._bvhVisualizer.update();
      });
    } catch {
      // ignore debug failures
    }
  }

  disposeBvhDebug() {
    if (this._bvhGroup && (this._characters as any)?.scene) {
      try {
        (this._characters as any).scene.remove(this._bvhGroup);
      } catch {}
    }
    this._bvhGroup = null;
    this._bvhVisualizer = null;
  }
}
