# Referência: controlador BVH do metaverso original (meta2022.worldaic.com.cn)

Fonte: `https://github.com/ezshine/AwesomeSites-Pack04` → `metaverse/meta2022.worldaic.com.cn`
(bundle `assets/index.ff37fac8.js` + chunks `enableBVHMap.*.js`, `enableBVHCharacter.*.js`,
`bvhCameraLoop.*.js`, `PhysicsUpdate.*.js`, `useBVHMap.*.js`).

O original é uma framework estilo enable3d (three.js + cannon-es + three-mesh-bvh) com
"componentes" reativos por objeto. O que interessa ao Guinomo é a parte **BVH pura** — sem
cannon — que já existe no nosso `src/engine/physics.ts`. Este documento regista a lógica
desminificada e o que adotámos/rejeitámos.

---

## 1. `enableBVHCharacter` (controlador do personagem)

```js
// registo do personagem (chamado quando um objeto entra no "sistema de caracteres"):
//   bvhHalfHeight = max(bbox.height * 0.5, 0.5)
//   bvhRadius     = max(bbox.halfExtents.x, 0.5)
//   bvhVelocity   = vec3(0)
//   bvhOnGround   = false
//   regista o objeto num Set de ativos; remove quando termina

// ticking (efeito reativo, por frame):
for (const o of ativos) {
  const s = o.bvhVelocity;

  if (!o.bvhOnGround) s.y += dt * -gravity * direcaoVertical;   // só aplica gravidade no ar

  // "positionUpdate" por eixo: se o eixo está bloqueado, zera a velocidade nesse eixo
  if (o.positionUpdate.x) s.x = 0;   // (idem y, z)

  o.position.addScaledVector(s, dt);
  o.updateMatrixWorld();

  // segmento do cápsula (center-based):
  //   start = position; end = position + Y(max(halfHeight - radius, 0))
  //   start.y -= radius; end.y += radius
  const hit = false;
  const box = AABB(center=position, size = (2r, 2*halfHeight, 2r));

  for (const map of bvhMaps) {
    map.shapecast({
      intersectsBounds: (boxB) => boxB.intersectsBox(box),
      intersectsTriangle: (tri) => {
        const p = tri.closestPointToSegment(segment, _a, _b);   // ponto mais próximo do segmento
        if (p.cmp < radius) {
          const normal = (_b - _a).normalize();
          segment.start += normal * (radius - p);
          segment.end   += normal * (radius - p);
          hit = true;
        }
      },
    });
  }

  if (hit) {
    // deslocamento real sofrido pelo fundo do segmento (posição anterior vs nova)
    const a = segment.start - posAntiga;
    // CHÃO: a resposta da colisão ergueu-nos mais do que a gravidade faria descer
    o.bvhOnGround = a.y > Math.abs(dt * s.y * 0.25);
    // REJEIÇÃO DE DECLIVE: se o empurrão é praticamente horizontal, é parede, não chão
    if (inclinacao && o.bvhOnGround && Math.abs(a.y) / (Math.abs(a.x) + Math.abs(a.z) + EPS) < inclinacao) {
      o.bvhOnGround = false;
    }
  }

  o.position.add(a);
  if (o.bvhOnGround) s.set(0, 0, 0);          // gruda ao chão
  else               s.addScaledVector(a.normalize(), -a.dot(s));  // projeta fora da velocidade
}
```

## 2. `bvhCameraLoop` (colisão da câmara)

Mesma ideia com uma esfera de raio **0.5**: caixa AABB `position ± 0.5`, shapecast,
`closestPointToSegment` e empurrão para fora ao longo do normal por `(0.5 - d)`.

## 3. `useBVHMap` + `enableBVHMap` (registo de mapas + debug)

- `useBVHMap` é um *store* reativo (set) dos meshes registados como mapa de colisão; o
  personagem e a câmara iteram todos os mapas (`for (const g of e) g.shapecast(...)`),
  permitindo **várias malhas de colisão**, não só uma `collider.bin`.
- `enableBVHMap` acrescenta visualizadores de debug: `MeshBVHRootVisualizer` (wireframe das
  caixas da BVH até uma profundidade) e `MeshBVHVisualizer` (malha semitransparente), com
  `displayEdges` e `displayParents`. Útil para validar o collider durante o desenvolvimento.

## 4. Decisões para o Guinomo

| Técnica original | Estado no Guinomo |
|---|---|
| Grounding por deslocamento + rejeição de declive | ✅ **Adotado** em `src/engine/physics.ts` (`_substep`, opção `slopeInclination`, default 1.0 ≈ 45°) — complementa o teste do normal no fundo do cápsula e apanha degraus/arestas |
| Só aplicar gravidade no ar + `velocity.set(0)` em chão | Já temos (fricção/damp + gravidade condicional) — mantido |
| Vários mapas de colisão por shapecast | ⏳ Futuro: permitir `colliderMeshes[]` em vez de só `collider.bin` |
| Colisão de câmara por sphere sweep (r=0.5) | ⏸️ Não adotado (raycast atual é suficiente; sweep mudaria o *feel* da órbita) |
| Visualizador de BVH (`map-debug`) | ⏳ Futuro: flag `?debug=bvh` opcional |
| cannon-es / física rígida | ❌ Rejeitado — BVH-only é mais leve e suficiente para o tipo de mundo |
| `PhysicsUpdate` com `updateX/Y/Z` | ❌ Rejeitado (bug no original: `updateY()`/`updateZ()` gravam só `this.x`) |