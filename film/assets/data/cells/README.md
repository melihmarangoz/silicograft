# Cell-slab data (SPEC P3-2)

Lattice slabs of run `bagsiz_orijinal_t12345` (unbonded plate, original sign, seed 12345, daily
0.1 mm lattice) for the film's three cell stops. Loaded by `assets/js/cells/slab.js`.

## Source

- Repository `~/mechanobio-hucre`, branch `hucre-gorunumu`, commit `3b7e79f`
  (3b7e79f0ce421b3380495f73e8f29fc84cc96361).
- `long_bone/web3d_uygulama/veri/bolgeler.json` -> `bolgeler.json` (copied byte for byte; it also
  lists `goc_cephesi`, whose data is not copied).
- `long_bone/web3d_uygulama/veri/bagsiz_orijinal_t12345/roi_<region>.b64.txt` -> `roi_<region>.bin`
  for `ilik_ucu`, `korteks_ucu`, `plak_alti`.
- Written by `long_bone/araclar/hucre3b_veri.py cikar` on that branch (the viewer reads it with
  `roiCoz` in `hucre3b.html`).

## Decoding

`roi_<region>.bin` = gunzip(base64decode(`roi_<region>.b64.txt`)): the uncompressed `MBR2` file that
`hucre3b_veri.py` wrote as `roi_<region>.bin.gz`. Nothing else is changed (the artifact host could
not serve `.bin`, so the viewer ships base64 text; the film serves the raw bytes and parses them
with a DataView, no decompression at load). Reproduce with:

```python
import base64, gzip
raw = gzip.decompress(base64.b64decode(open('roi_ilik_ucu.b64.txt').read().strip()))
```

| File | Bytes | md5 |
|---|---|---|
| `bolgeler.json` | 1140 | e60dd0aed9bb3ab00df165ace6beb14d |
| `roi_ilik_ucu.bin` | 2302336 | bb9442385d3c4d9814f11cf8ed277113 |
| `roi_korteks_ucu.bin` | 2302336 | 1251f514e156a9924e5e947128b42781 |
| `roi_plak_alti.bin` | 2302336 | 9409e9a81644ca96e391310cfb94d37d |

Checked on 2026-11-07: each `.bin` equals the decoded source byte for byte.

## Format `MBR2` (little endian)

```
char[4]  'MBR2'
uint16   nx, ny, nz, n_days, m          box size in sites WITH the margin m on every side; m = 3
int16    i0, j0, k0                     lattice origin of the box (margin included)
uint16   days[n_days]                   0, 1, ..., 359 (consecutive)
uint8    mask[nx*ny*nz]                 0 outside the callus, 1 callus element, 2 marrow cavity (mid-frontal plane, repeated along i)
uint8    codes[n_days][ceil(nx*ny*nz/2)] 4-bit codes, two sites per byte, low nibble first
```

Site index `s = (i * ny + j) * nz + k` (box-local i, j, k). Codes: 0 empty, 1 MSC, 2 bone cell,
4 chondrocyte, 5 fibroblast, 11 intact cortex, 13 plate (transient mitosis/migration codes 6-10 were
already mapped back to 1-5 by the writer).

All three files: nx = 11, ny = 34, nz = 34 (a 5 x 28 x 28 site slab plus the 3-site margin),
360 days, 2.3 MB each.

| Region | i0, j0, k0 (with margin) | Visible slab (lattice) | Scene centre (mm) |
|---|---|---|---|
| `ilik_ucu` | 175, 163, 333 | i 178-182, j 166-193, k 336-363 | (0, 14.95, -0.05) |
| `korteks_ucu` | 175, 73, 343 | i 178-182, j 76-103, k 346-373 | (0, 15.95, -9.05) |
| `plak_alti` | 175, 241, 276 | i 178-182, j 244-271, k 279-306 | (0, 9.25, 7.75) |

Lattice (i, j, k) -> model mm (i * 0.1 - 18, j * 0.1 - 18, k * 0.1) -> scene by the manifest's
`scene_transform` (scene x = -model x, y = model z - 20, z = model y). Each visible slab is
0.5 x 2.8 x 2.8 mm in scene (x, y, z) and straddles the cut plane x = 0 (lattice i 180 = model x 0).

What the slabs hold (core slab only, agents per type):

| Region | days | content |
|---|---|---|
| `ilik_ucu` | 0 / 9 / 30 | 777 / 1423 / 2022 MSCs, nothing else (marrow-cavity mask: no cortex, no plate in the slab) |
| `korteks_ucu` | 120 / 180 / 220 | MSC 1537 / 1937 / 1951, bone cells 1444 / 1058 / 1049, intact cortex (920 sites, fixed) |
| `plak_alti` | 220 / 300 / 357 | MSC 1476 / 2560 / 1847, bone cells 404 / 734 / 1346, chondrocytes 0 / 0 / 484, fibroblasts 0 / 0 / 57, plate (183 sites, fixed) |
