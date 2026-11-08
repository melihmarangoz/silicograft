#!/usr/bin/env python3
"""Export the lattice sites of a small region of interest (ROI) for the film's cell close-up (film/SPEC.md, b2).

The film's voxels (film_export.py, vox_days.bin) are 0.3 mm blocks. The b2 close-up draws one cell per
occupied 0.1 mm lattice site, so it needs the lattice itself in a small box: here, by default, the
proximal bone end next to the marrow, just behind the cut plane x = 0 (kept half, x <= 0), for days 0..30.

Reads lattice_N.raw[.zst] of the run one day at a time (about 52 MB each) and writes to --out:

  roi_cells.bin   site_ijk  uint16 (N, 3)   global lattice indices (i, j, k) of every site of the box that
                                            holds a tissue code (1, 2, 4, 5) on at least one exported day
                  in_callus uint8  (N,)     1 if the site is inside the callus mesh (lattice-element map
                                            != 0, Lattice_point_in_element.cpp), 0 otherwise (marrow canal
                                            of the bone end); omitted from the checks if the map is missing
                  codes     uint8  (D, N)   lattice code of each site on each exported day (day-major)
  roi_cells.json  the layout (offsets, dtypes, shapes), the box, the coordinate frames, per-day counts and
                  the checks

Checks (the script stops if one fails): the whole-lattice MSC count of every day equals
istatistik.csv MSC + MSC_kallus_disi; the bone/cartilage/fibrous counts inside the callus mesh equal
istatistik.csv (when the lattice-element map is available); and the written file is read back and
compared with the lattice of the first and the last day.

Usage (from the repo root):
  python3 long_bone/araclar/film_export_roi.py --run <run folder> --out film/assets/data
"""
import argparse, json, os, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import site_stages as ss  # noqa: E402

NX, NY, NZ = ss.NX, ss.NY, ss.NZ
CELL = float(ss.CELL)
TISSUE = (1, 2, 4, 5)
CODE_NAME = {0: "empty", 1: "stem_cell", 2: "bone", 4: "chondrocyte", 5: "fibroblast", 11: "intact_bone",
             12: "scaffold", 13: "plate"}
# Default box: lattice indices, inclusive. i 162..179 is scene x 0.1..1.8 mm behind the cut face (the voxel
# half filter keeps blocks bi <= 59, i.e. i <= 179); j 130..190 is scene z -5..+1 mm (marrow j 138..223,
# cortex below j 138); k 332..353 is scene y 13.2..15.3 mm (proximal bone end face at k = 350, z = 35 mm).
DEFAULT_BOX = dict(i=(162, 179), j=(130, 190), k=(332, 353))


def log(*a):
    print(*a, flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--run", required=True, help="run folder (lattice_N.raw[.zst], istatistik.csv)")
    ap.add_argument("--out", required=True, help="output folder (film/assets/data)")
    ap.add_argument("--days", default="0-30", help="first-last day, inclusive (default 0-30)")
    ap.add_argument("--box", default=None, help="i0,i1,j0,j1,k0,k1 lattice indices, inclusive")
    ap.add_argument("--cache", default=os.path.expanduser("~/mechanobio_calculix/site_stages_cache"),
                    help="site_stages / film_export cache (lattice_element_map.npy is read from there)")
    a = ap.parse_args()
    t0 = time.time()
    run = os.path.abspath(os.path.expanduser(a.run))
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    d0, d1 = (int(v) for v in a.days.split("-"))
    days = list(range(d0, d1 + 1))
    if a.box:
        v = [int(x) for x in a.box.split(",")]
        box = dict(i=(v[0], v[1]), j=(v[2], v[3]), k=(v[4], v[5]))
    else:
        box = DEFAULT_BOX
    (i0, i1), (j0, j1), (k0, k1) = box["i"], box["j"], box["k"]
    assert 0 <= i0 <= i1 < NX and 0 <= j0 <= j1 < NY and 0 <= k0 <= k1 < NZ, box
    sl = (slice(i0, i1 + 1), slice(j0, j1 + 1), slice(k0, k1 + 1))
    shape = (i1 - i0 + 1, j1 - j0 + 1, k1 - k0 + 1)

    stat_rows = [l.strip().split(",") for l in open(os.path.join(run, "istatistik.csv"))]
    stat = {int(r[0]): dict(zip(stat_rows[0], map(int, r))) for r in stat_rows[1:]}

    # Callus mask of the box (memory-mapped: only the box is read).
    key = f"{os.path.basename(run)}_{os.path.getsize(os.path.join(run, 'element_file.txt'))}"
    lpe_path = os.path.join(a.cache, key, "lattice_element_map.npy")
    lpe = np.load(lpe_path, mmap_mode="r") if os.path.exists(lpe_path) else None
    if lpe is not None:
        assert lpe.shape == (NX, NY, NZ), lpe.shape
        callus_box = np.asarray(lpe[sl]) != 0
        callus_all = lpe  # memory-mapped, used for the istatistik check below
    else:
        log(f"  no lattice-element map at {lpe_path}: in_callus is not written, callus checks skipped")
        callus_box = None

    verify = {}
    box_codes = np.empty((len(days),) + shape, np.uint8)
    counts = {}
    for n, d in enumerate(days):
        L = ss.read_lattice(run, d)
        box_codes[n] = L[sl]
        msc_all = int(np.count_nonzero(L == 1))
        want = stat[d]["MSC"] + stat[d]["MSC_kallus_disi"]
        assert msc_all == want, f"day {d}: lattice MSC {msc_all} != istatistik MSC + MSC_kallus_disi {want}"
        if lpe is not None and n in (0, len(days) - 1):
            # bone, cartilage, fibrous inside the callus mesh (istatistik.csv counts the callus only)
            for code, col in ((2, "kemik"), (4, "kikirdak"), (5, "fibroz")):
                got = 0
                for s0 in range(0, NX, 40):   # in slabs, so the memory map is not read at once
                    s1 = min(NX, s0 + 40)
                    got += int(np.count_nonzero((L[s0:s1] == code) & (np.asarray(callus_all[s0:s1]) != 0)))
                assert got == stat[d][col], f"day {d}: callus {col} {got} != istatistik {stat[d][col]}"
        del L
        b = box_codes[n]
        counts[str(d)] = {CODE_NAME.get(c, str(c)): int(np.count_nonzero(b == c)) for c in (1, 2, 4, 5, 11, 13)}
        log(f"  day {d}: box {counts[str(d)]}")
    verify["msc_whole_lattice_vs_istatistik"] = (f"all {len(days)} days: lattice code-1 count = istatistik.csv "
                                                 "MSC + MSC_kallus_disi")
    if lpe is not None:
        verify["callus_tissue_vs_istatistik"] = (f"days {days[0]} and {days[-1]}: bone, cartilage and fibrous counts "
                                                 "inside the callus mesh = istatistik.csv")

    tissue = np.isin(box_codes, TISSUE).any(0)
    ijk_local = np.argwhere(tissue)                     # (N, 3), C order: i, then j, then k
    N = len(ijk_local)
    site_ijk = (ijk_local + np.array([i0, j0, k0])).astype(np.uint16)
    codes = box_codes[:, ijk_local[:, 0], ijk_local[:, 1], ijk_local[:, 2]].astype(np.uint8)   # (D, N)
    in_callus = (callus_box[ijk_local[:, 0], ijk_local[:, 1], ijk_local[:, 2]].astype(np.uint8)
                 if callus_box is not None else None)

    bin_path = os.path.join(out, "roi_cells.bin")
    arrays, off = {}, 0
    with open(bin_path, "wb") as f:
        def put(name, arr, meaning):
            nonlocal off
            arr = np.ascontiguousarray(arr)
            pad = (-off) % 4
            if pad:
                f.write(b"\0" * pad); off += pad
            f.write(arr.astype(arr.dtype.newbyteorder("<"), copy=False).tobytes())
            arrays[name] = dict(offset=off, dtype=str(arr.dtype), shape=list(arr.shape), meaning=meaning)
            off += arr.nbytes
        put("site_ijk", site_ijk, "global lattice indices (i, j, k) of each site; model mm = origin + 0.1 * (i, j, k)")
        if in_callus is not None:
            put("in_callus", in_callus, "1 = inside the callus mesh (lattice-element map != 0), 0 = outside "
                                        "(marrow canal of the bone end)")
        put("codes", codes, "lattice code of site n on exported day d at [d, n] (codes: 0 empty, 1 stem cell, "
                            "2 bone (osteoblast), 4 chondrocyte, 5 fibroblast, 11 intact bone, 13 plate)")

    # Read back and compare with the lattice on the first and the last day.
    raw = open(bin_path, "rb").read()
    rb_ijk = np.frombuffer(raw, np.uint16, N * 3, arrays["site_ijk"]["offset"]).reshape(N, 3)
    rb_codes = np.frombuffer(raw, np.uint8, len(days) * N, arrays["codes"]["offset"]).reshape(len(days), N)
    for n in (0, len(days) - 1):
        L = ss.read_lattice(run, days[n])
        assert (L[rb_ijk[:, 0], rb_ijk[:, 1], rb_ijk[:, 2]] == rb_codes[n]).all(), f"read-back day {days[n]}"
        tissue_box = int(np.isin(L[sl], TISSUE).sum())
        assert tissue_box == int(np.isin(rb_codes[n], TISSUE).sum()), f"tissue count day {days[n]}"
        del L
    verify["read_back"] = f"roi_cells.bin codes = lattice at every exported site on days {days[0]} and {days[-1]}"

    origin = [-18.0, -18.0, 0.0]   # manifest.model_frame.lattice.origin_mm (callus mesh min corner)
    lo_mm = [origin[0] + CELL * i0, origin[1] + CELL * j0, origin[2] + CELL * k0]
    hi_mm = [origin[0] + CELL * i1, origin[1] + CELL * j1, origin[2] + CELL * k1]
    meta = dict(
        generator="long_bone/araclar/film_export_roi.py",
        created=time.strftime("%Y-%m-%d %H:%M:%S"),
        endianness="little",
        run=run,
        purpose="b2 close-up of the film (film/SPEC.md): one drawn cell per occupied lattice site",
        file="roi_cells.bin",
        arrays=arrays,
        n_sites=int(N),
        days=days,
        lattice=dict(shape=[NX, NY, NZ], spacing_mm=CELL, origin_mm=origin,
                     point_mm="model (x, y, z) = origin + 0.1 * (i, j, k)"),
        box=dict(index_inclusive=dict(i=list(box["i"]), j=list(box["j"]), k=list(box["k"])),
                 site_centres_model_mm=dict(lo=lo_mm, hi=hi_mm),
                 site_centres_scene_mm=dict(x=[-hi_mm[0], -lo_mm[0]], y=[lo_mm[2] - 20, hi_mm[2] - 20],
                                            z=[lo_mm[1], hi_mm[1]]),
                 note="scene = manifest.scene_transform: scene.x = -model.x, scene.y = model.z - 20, "
                      "scene.z = model.y. The box lies in the kept half (model x <= -0.1, scene x >= 0.1), "
                      "just behind the cut face, at the proximal bone end (end face k = 350, model z = 35, "
                      "scene y = 15) next to the marrow (j >= 138) and the cortex (j < 138)."),
        site_rule="a site is listed when it holds a tissue code (1, 2, 4 or 5) on at least one exported day; "
                  "on other days its code may be 0 (empty)",
        counts_per_day=counts,
        codes={str(k): v for k, v in CODE_NAME.items()},
        verification=verify,
        seconds=round(time.time() - t0, 1),
    )
    with open(os.path.join(out, "roi_cells.json"), "w") as f:
        json.dump(meta, f, indent=1)
    log(f"wrote {bin_path} ({off} bytes, {N} sites x {len(days)} days) in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
