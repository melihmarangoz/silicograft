// Level-of-detail variant of ../vendor/hucre_geometri.js (the cell viewer's procedural cells,
// ~/mechanobio-hucre branch hucre-gorunumu, commit 3b7e79f). The code is the vendored function with
// one change: `detail` scales the tessellation counts (surface segments and rings, tube sides and
// steps). The PRNG calls do not depend on those counts, so every detail level draws the SAME cells
// (same sizes, processes, noise phases), only with fewer triangles; detail = 1 reproduces the vendored
// geometry exactly (checked by .hyperframes/cells-bench). Used by slab.js for small on-screen cells.
export function cellGeometriesLod(THREE, { varyant = 3, tohum = 1, detail = 1 } = {}) {
  // tessellation counts scaled by `detail`; the PRNG sequence does not depend on them
  const D = (n, min) => Math.max(min, Math.round(n * detail));
  let state = tohum >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = (a, b) => a + (b - a) * random();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const unit = v => v.clone().normalize();

  // Pieces retain their own rounding targets when combined into one geometry.
  function mesh(vertices, indices, tips, targets) {
    return { vertices, indices, tips, targets };
  }
  function surface(rx, ry, rz, radius, options = {}) {
    const { segments: segments0 = 20, rings: rings0 = 10, noise = 0.035, offset = V(0, 0, 0), shape = 'ellipsoid', sides = 6 } = options;
    const segments = D(segments0, 6), rings = D(rings0, 4);
    const vertices = [], indices = [], tips = [], targets = [];
    const phase = rand(0, 6.28), phase2 = rand(0, 6.28), polyPhase = rand(0, 6.28);
    // Each ring has `segments` vertices and wraps around, so smooth normals have no seam.
    for (let j = 0; j <= rings; j++) {
      const theta = Math.PI * j / rings;
      for (let i = 0; i < segments; i++) {
        const phi = 2 * Math.PI * i / segments;
        let x = Math.sin(theta) * Math.cos(phi), y = Math.cos(theta), z = Math.sin(theta) * Math.sin(phi);
        const n = 1 + noise * (Math.sin(3 * phi + phase) * Math.sin(theta) ** 2 + 0.5 * Math.cos(5 * phi + phase2) * Math.sin(theta) ** 3);
        if (shape === 'box') {
          // Cobblestone cell: a rounded 5-6 sided footprint, a genuinely planar basal face (-Y),
          // straight-ish lower walls and a domed apical face (+Y).
          const s = Math.sin(theta), c = Math.cos(theta);
          y = c < -0.65 ? -1 : (c + 0.65) / 1.65 * 2 - 1;
          const seg = 2 * Math.PI / sides, loc = (((phi + polyPhase) % seg) + seg) % seg - seg / 2;
          const polygon = 0.7 * Math.cos(Math.PI / sides) / Math.cos(loc) + 0.3;   // rounded corners
          const t = (y + 1) / 2, dome = t < 0.5 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.5) ** 2));
          const foot = Math.min(1, s * 2.5) * dome;
          x = Math.cos(phi) * polygon * foot;
          z = Math.sin(phi) * polygon * foot;
          if (j === rings || j === 0) { x = 0; z = 0; }
        }
        const p = V(x * rx * n, y * ry, z * rz * n).add(offset);
        vertices.push(p.x, p.y, p.z); tips.push(0);
        const target = unit(p).multiplyScalar(radius);
        targets.push(target.x, target.y, target.z);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
      const i1 = (i + 1) % segments;
      const a = j * segments + i, a1 = j * segments + i1, b = a + segments, b1 = a1 + segments;
      if (j !== 0) indices.push(a, a1, b);
      if (j !== rings - 1) indices.push(a1, b1, b);
    }
    return mesh(vertices, indices, tips, targets);
  }
  function tube(base, direction, length, r0, r1, radius, sides0 = 4, steps0 = 4, bend = 0.12) {
    const sides = D(sides0, 3), steps = D(steps0, 2);
    const d = unit(direction), helper = Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(0, 0, 1);
    const u = unit(new THREE.Vector3().crossVectors(d, helper)), v = unit(new THREE.Vector3().crossVectors(d, u));
    const vertices = [], indices = [], tips = [], targets = [];
    const target = unit(base).multiplyScalar(radius), phase = rand(0, 6.28);
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const center = base.clone().addScaledVector(d, length * t).addScaledVector(u, Math.sin(Math.PI * t) * bend * length).addScaledVector(v, Math.sin(2 * Math.PI * t + phase) * bend * length * t * 0.3);
      const r = r0 * (1 - t) + r1 * t;
      for (let i = 0; i < sides; i++) {
        const angle = 2 * Math.PI * i / sides;
        const p = center.clone().addScaledVector(u, Math.cos(angle) * r).addScaledVector(v, Math.sin(angle) * r);
        vertices.push(p.x, p.y, p.z); tips.push(t); targets.push(target.x, target.y, target.z);
      }
    }
    for (let j = 0; j < steps; j++) for (let i = 0; i < sides; i++) {
      const a = j * sides + i, b = j * sides + (i + 1) % sides, c = a + sides, d2 = b + sides;
      indices.push(a, b, c, b, d2, c);
    }
    return mesh(vertices, indices, tips, targets);
  }
  function merge(parts) {
    const positions = [], indices = [], tips = [], targets = [];
    let offset = 0;
    for (const p of parts) {
      positions.push(...p.vertices); tips.push(...p.tips); targets.push(...p.targets);
      for (const i of p.indices) indices.push(i + offset);
      offset += p.vertices.length / 3;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aUc', new THREE.Float32BufferAttribute(tips, 1));
    geometry.setAttribute('aKure', new THREE.Float32BufferAttribute(targets, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }
  const nucleus = (x, y, z, radius, offset = V(0, 0, 0)) => merge([surface(x, y, z, radius * 0.6, { segments: 14, rings: 8, noise: 0.018, offset })]);
  const output = { msc: [], fibroblast: [], kondrosit: [], osteoblast: [], osteosit: [] };
  for (let k = 0; k < varyant; k++) {
    {
      // Bipolar spindle: a central soma around the nucleus tapering both ways, a thick leading process
      // ending in a small flat lamellipodium with filopodia (+X), a long trailing tail (-X) and at most one
      // thin side branch, all close to the cell's flat plane.
      const r = 9, parts = [surface(rand(12, 15), rand(3, 4), rand(5, 6.5), r, { noise: 0.08 })];
      const lead = rand(12, 20), tipX = 9 + lead;
      parts.push(tube(V(8, 0, 0), V(1, rand(-0.04, 0.04), rand(-0.15, 0.15)), lead, rand(2.8, 3.4), 1.1, r, 6, 6, 0.08));
      const fan = surface(3.5, 0.5, rand(4, 5.5), r, { offset: V(tipX, 0, 0), segments: 14, rings: 7, noise: 0.12 });
      for (let j = 0; j < fan.tips.length; j++) {
        fan.tips[j] = Math.max(0.5, Math.min(1, 0.5 + (fan.vertices[j * 3] - tipX + 3.5) / 14));
        const target = unit(V(9, 0, fan.vertices[j * 3 + 2] * 0.3)).multiplyScalar(r);
        fan.targets.splice(j * 3, 3, target.x, target.y, target.z);
      }
      parts.push(fan);
      const count = 3 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const z = -3.5 + 7 * i / (count - 1);
        const filo = tube(V(tipX + 3, 0, z), V(1, rand(-0.05, 0.05), z * 0.15), rand(3, 7), 0.25, 0.08, r, 3, 3);
        for (let j = 0; j < filo.tips.length; j++) filo.tips[j] = 0.8 + 0.2 * filo.tips[j];
        parts.push(filo);
      }
      parts.push(tube(V(-10, 0, 0), V(-1, rand(-0.05, 0.05), rand(-0.2, 0.2)), rand(20, 34), rand(2.4, 3.0), 0.3, r, 6, 7, 0.12));
      if (random() < 0.6) {
        const side = random() < 0.5 ? -1 : 1, angle = Math.PI * rand(0.6, 0.8);
        parts.push(tube(V(rand(-5, 3), 0, side * 3.5), V(Math.cos(angle) * 0.6, rand(-0.05, 0.05), side * Math.sin(angle)), rand(10, 18), rand(0.9, 1.3), 0.2, r, 5, 5, 0.18));
      }
      output.msc.push({ govde: merge(parts), cekirdek: nucleus(rand(5, 6), rand(2.4, 2.8), rand(3.5, 4.2), r) });
    }
    {
      const r = 8, parts = [surface(rand(14, 18), rand(1.5, 2.5), rand(4, 6), r)];
      for (const sign of [-1, 1]) parts.push(tube(V(sign * 12, 0, 0), V(sign, rand(-0.04, 0.04), rand(-0.12, 0.12)), rand(16, 23), 2.2, 0.18, r, 6, 6));
      const n = 1 + Math.floor(random() * 2);
      for (let i = 0; i < n; i++) { const sign = i ? 1 : -1; parts.push(tube(V(rand(-5, 5), 0, sign * 3), V(rand(-0.5, 0.5), 0, sign), rand(10, 20), 1.4, 0.12, r, 4, 4)); }
      output.fibroblast.push({ govde: merge(parts), cekirdek: nucleus(rand(6, 7.5), rand(1.5, 2), rand(2.5, 3), r) });
    }
    {
      const r = 7, x = rand(6.5, 8), y = rand(4.5, 6), z = rand(6, 7.5);
      output.kondrosit.push({ govde: merge([surface(x, y, z, r, { segments: 20, rings: 12, noise: 0.009 })]), cekirdek: nucleus(rand(3, 4), rand(3, 4), rand(3, 4), r), kapsul: merge([surface(x * 1.6, y * 1.6, z * 1.6, r, { segments: 18, rings: 10, noise: 0.012 })]) });
    }
    {
      const r = 9, y = rand(7.5, 10), parts = [surface(rand(9, 12), y, rand(8, 11), r, { shape: 'box', sides: 5 + Math.floor(random() * 2), segments: 24, rings: 12, noise: 0.05 })];
      // short basal processes that reach into the osteoid just under the cell
      const n = 3 + Math.floor(random() * 3);
      for (let i = 0; i < n; i++) { const angle = 2 * Math.PI * (i + rand(-0.15, 0.15)) / n; parts.push(tube(V(5 * Math.cos(angle), -y + 0.6, 4 * Math.sin(angle)), V(0.35 * Math.cos(angle), -1, 0.35 * Math.sin(angle)), rand(3, 6), 0.6, 0.2, r, 4, 3)); }
      output.osteoblast.push({ govde: merge(parts), cekirdek: nucleus(rand(4, 5), rand(4, 5), rand(4, 5), r, V(0, y * 0.25, 0)) });
    }
    {
      const r = 7, x = rand(7.5, 10), y = rand(3, 4), z = rand(4.5, 6), parts = [surface(x, y, z, r, { segments: 18, rings: 10, noise: 0.025 })];
      // Fewer, finer and wavier dendrites of uneven length, so the cell reads as a branched network node
      // rather than a spiky ball; about half branch once.
      const n = 18 + Math.floor(random() * 9);
      for (let i = 0; i < n; i++) {
        const a = i * 2.399963 + rand(-0.3, 0.3), h = -1 + 2 * (i + rand(0.2, 0.8)) / n;
        const d = unit(V(h * 0.55, Math.sqrt(1 - h * h) * Math.cos(a), Math.sqrt(1 - h * h) * Math.sin(a)));
        const dist = 0.82 / Math.sqrt((d.x / x) ** 2 + (d.y / y) ** 2 + (d.z / z) ** 2);
        const base = d.clone().multiplyScalar(dist), length = rand(8, 30);
        parts.push(tube(base, d, length, 0.45, 0.15, r, 3, 5, 0.15));
        if (i % 2 === 0) {
          const branchBase = base.clone().addScaledVector(d, length * rand(0.35, 0.6));
          const branchDir = unit(d.clone().add(V(rand(-0.7, 0.7), rand(-0.7, 0.7), rand(-0.7, 0.7))));
          // Branches collapse to the same sphere point as their parent process.
          const branch = tube(branchBase, branchDir, length * rand(0.4, 0.7), 0.3, 0.12, r, 3, 4, 0.15);
          const target = unit(base).multiplyScalar(r);
          for (let j = 0; j < branch.tips.length; j++) { branch.tips[j] = 0.52 + branch.tips[j] * 0.48; branch.targets.splice(j * 3, 3, target.x, target.y, target.z); }
          parts.push(branch);
        }
      }
      output.osteosit.push({ govde: merge(parts), cekirdek: nucleus(rand(3.5, 4.5), rand(2, 2.5), rand(3, 3.5), r) });
    }
  }
  return output;
}

