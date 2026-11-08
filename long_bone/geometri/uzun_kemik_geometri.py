"""Koyun uzun kemigi 30 mm segmental defekt modeli (mechanobio_bone_2 main dali) icin
CalculiX ag ve sablon ureteci.

Geometri kaynaklari:
  [C++]  mechanobio_bone_2-main/main.cpp, Initialize_lattice.cpp (kafes 36x36x40 mm, 0.1 mm)
         - korteks elips yari eksenleri x 7.5, y 8.5 mm; ilik 3.75 x 4.4 mm
         - kemik uclari kafeste 5 mm (z 0-5 ve 35-40), aradaki 30 mm defekt
         - plak: |x| < 6.8 mm, korteksin +y yuzeyinin ustunde, 5.6 mm kalin
         - Calculate_lattice: kafes orijini = kallus agi min koseleri, kemik ekseni kafes merkezinde
           => kallus sinir kutusu x,y icin [-18, 18] mm, z icin [0, 40] mm olmali
  [Perier-Metz 2020, Front Bioeng Biotechnol 8:585799, ayni grup]
         - kallus: "bir cember yayinin dondurulmesiyle, orta yukseklikte en fazla 10 mm kalinlik,
           kemik uclarini ortuyor"; malzemeler: korteks 17 GPa, ilik 2 MPa, celik 210 GPa
  [C++ main Update_model.cpp] yukler: 823 N eksenel basma + 9777 N.mm moment (DOF 5),
         distal uc ankastre, proksimal referans noktasi DOF 1,2,6 sabit
  [Perier-Metz 2022, Acta Biomater 145:329, kodun yayini] plak 155 x 13.5 x 5.6 mm, 6 vida r = 1.75 mm,
         tie yalnizca kallus-saglam kemik ve vida-kemik arasinda: KALLUS PLAGA BAGLI DEGIL
         (plak-kallus arayuzundeki dugumler ikizlenir, --plak-bagli ile eski davranis)
  [VARSAYIM] kemik toplam boyu 200 mm ("20 cm'lik kemik", moment hesabi), vida yerleri,
         plak alt yuzeyi y = 9.0 (korteksle 0.5 mm bosluk; kafeste plak 8.6'dan basliyor),
         kallusun plak ustunde olmamasi, kallus uc yaricapi 9 mm.

Ciktilar (--cikti klasorune):
  model_sablon.inp     tum dugumler, elemanlar, sabit malzemeler, rijit govde, sinir kosullari
                       (kallus malzemeleri + adim C++ Update_model tarafindan eklenir)
  node_file.txt        tum dugumler "etiket, x, y, z"
  element_file.txt     kallus elemanlari "etiket, n1..n10" (Abaqus/CalculiX C3D10 sirasi)
  model_bilgi.h        NUMBER_NODES, NUMBER_ELEMS
  ag.vtu               ParaView ile bakmak icin (bolge etiketli)
  ag_ozeti.json
"""
import argparse, json, math, os, sys
import numpy as np
import gmsh

p = argparse.ArgumentParser()
p.add_argument("--kallus-boyu", type=float, default=1.6, help="kallus eleman boyu (mm)")
p.add_argument("--kemik-boyu", type=float, default=2.5, help="korteks/ilik/plak eleman boyu (mm)")
p.add_argument("--vida-boyu", type=float, default=1.0)
p.add_argument("--cikti", default="ag")
p.add_argument("--plak-bagli", action="store_true", help="eski davranis: kallus plaga ortak dugumlerle bagli")
p.add_argument("--sadece-hacim", action="store_true", help="ag uretmeden hacimleri yaz")
a = p.parse_args()
os.makedirs(a.cikti, exist_ok=True)

# ------------------------------------------------------------------ parametreler (mm)
KX, KY = 7.5, 8.5          # korteks dis elips [C++]
IX, IY = 3.75, 4.4         # ilik elips [C++]
Z_DEF0, Z_DEF1 = 5.0, 35.0 # defekt [C++]
Z_LAT0, Z_LAT1 = 0.0, 40.0 # kafes z araligi [C++]
R_MAX = 18.0               # kallus orta yaricap = kafes yari genisligi [C++ + Perier-Metz 2020]
R_UC = 9.0                 # kallusun z=0 ve 40'taki yaricapi [VARSAYIM]
L_DIS = 80.0               # kemik uclarinin kafes disindaki uzunlugu: toplam 200 mm [VARSAYIM]
PLAK_X = 6.8               # [C++] |i-180| < 68
PLAK_Y0, PLAK_T = 9.0, 5.6 # [VARSAYIM y0] [C++ kalinlik]
PLAK_L = 155.0             # [Perier-Metz 2022]
VIDA_R = 1.75              # [Perier-Metz 2022]
VIDA_Z = [-50.0, -35.0, -20.0, 60.0, 75.0, 90.0]  # [VARSAYIM] her uca 3 vida, 15 mm aralik, kallusun disinda

gmsh.initialize()
gmsh.option.setNumber("General.Terminal", 1)
gmsh.option.setNumber("General.Verbosity", 2)
gmsh.model.add("uzun_kemik")
occ = gmsh.model.occ

# --- kallus: cember yayinin z ekseni etrafinda dondurulmesi
zc = 0.5 * (Z_LAT0 + Z_LAT1); hz = 0.5 * (Z_LAT1 - Z_LAT0)
R_yay = ((R_MAX - R_UC) ** 2 + hz ** 2) / (2 * (R_MAX - R_UC))
xc = R_MAX - R_yay
p0 = occ.addPoint(0, 0, Z_LAT0); p1 = occ.addPoint(R_UC, 0, Z_LAT0)
pc = occ.addPoint(xc, 0, zc); p2 = occ.addPoint(R_UC, 0, Z_LAT1); p3 = occ.addPoint(0, 0, Z_LAT1)
pm = occ.addPoint(R_MAX, 0, zc)  # en genis nokta ayri kose olsun -> ag dugumu tam R_MAX'ta
l1 = occ.addLine(p0, p1); arc1 = occ.addCircleArc(p1, pc, pm); arc2 = occ.addCircleArc(pm, pc, p2)
l2 = occ.addLine(p2, p3); l3 = occ.addLine(p3, p0)
s = occ.addPlaneSurface([occ.addCurveLoop([l1, arc1, arc2, l2, l3])])
# 4 ceyrek dondurme: dikis cizgileri x=+-18 ve y=+-18'de -> kallus min koseleri tam -18 mm
# (C++ Calculate_lattice kafes orijinini kallus dugumlerinin min koordinatina koyuyor)
kallus = []
for q in range(4):
    s_q = occ.copy([(2, s)])
    occ.rotate(s_q, 0, 0, 0, 0, 0, 1, q * math.pi / 2)
    rev = occ.revolve(s_q, 0, 0, 0, 0, 0, 1, math.pi / 2)
    kallus += [e for e in rev if e[0] == 3]
occ.remove([(2, s)], recursive=True)
kallus, _ = occ.fuse(kallus[:1], kallus[1:])

def elips_silindir(rx, ry, z0, z1):
    # OCC elipsinde buyuk eksen x'te olmali -> buyuk ekseni x'e koyup 90 derece dondur
    big, small = max(rx, ry), min(rx, ry)
    d = occ.addDisk(0, 0, z0, big, small)
    if ry > rx:
        occ.rotate([(2, d)], 0, 0, 0, 0, 0, 1, math.pi / 2)
    ex = occ.extrude([(2, d)], 0, 0, z1 - z0)
    return [e for e in ex if e[0] == 3]

kemik_d = elips_silindir(KX, KY, Z_LAT0 - L_DIS, Z_DEF0)
kemik_p = elips_silindir(KX, KY, Z_DEF1, Z_LAT1 + L_DIS)
ilik_d = elips_silindir(IX, IY, Z_LAT0 - L_DIS, Z_DEF0)
ilik_p = elips_silindir(IX, IY, Z_DEF1, Z_LAT1 + L_DIS)
z_plak0, z_plak1 = zc - PLAK_L / 2, zc + PLAK_L / 2
plak = [(3, occ.addBox(-PLAK_X, PLAK_Y0, z_plak0, 2 * PLAK_X, PLAK_T, z_plak1 - z_plak0))]
plak_ust = [(3, occ.addBox(-PLAK_X, PLAK_Y0, Z_LAT0 - 1, 2 * PLAK_X, 30, Z_LAT1 - Z_LAT0 + 2))]
vidalar = []
for z in VIDA_Z:
    vidalar.append((3, occ.addCylinder(0, -KY - 1.0, z, 0, KY + 1.0 + PLAK_Y0 + PLAK_T, 0, VIDA_R)))
occ.synchronize()

# kallus = ig - kemik uclari (ilik dahil) - plak ve ustu
kemik_kopya = occ.copy(kemik_d + kemik_p)
kallus, _ = occ.cut(kallus, kemik_kopya + plak_ust, removeObject=True, removeTool=True)
occ.synchronize()

# hepsini parcala -> uyumlu (conformal) ag, arayuzler ortak
nesneler = {"KALLUS": kallus, "VIDA": vidalar, "PLAK": plak, "ILIK": ilik_d + ilik_p, "KORTEKS": kemik_d + kemik_p}
tum = []
sahip = []
for ad, lst in nesneler.items():
    for e in lst:
        tum.append(e); sahip.append(ad)
out, out_map = occ.fragment(tum, [])
occ.synchronize()
# oncelik: VIDA > PLAK > KALLUS > ILIK > KORTEKS (ust uste binen parca once gelenin)
oncelik = ["VIDA", "PLAK", "KALLUS", "ILIK", "KORTEKS"]
bolge = {}
for (e, ad) in zip(out_map, sahip):
    for v in e:
        if v[0] != 3: continue
        onceki = bolge.get(v[1])
        if onceki is None or oncelik.index(ad) < oncelik.index(onceki):
            bolge[v[1]] = ad
for ad in oncelik:
    tags = [t for t, b in bolge.items() if b == ad]
    gmsh.model.addPhysicalGroup(3, tags, name=ad)

hacim = {ad: 0.0 for ad in oncelik}
for t, b in bolge.items():
    hacim[b] += occ.getMass(3, t)
print("Hacimler (mm3):", {k: round(v, 1) for k, v in hacim.items()})
bb = [gmsh.model.getBoundingBox(3, t) for t, b in bolge.items() if b == "KALLUS"]
bbk = (min(b[0] for b in bb), min(b[1] for b in bb), min(b[2] for b in bb), max(b[3] for b in bb), max(b[4] for b in bb), max(b[5] for b in bb))
print("Kallus sinir kutusu:", [round(x, 3) for x in bbk])
if a.sadece_hacim:
    gmsh.finalize(); sys.exit(0)

# --- ag boyutlari: hacim basina sabit alan
gmsh.option.setNumber("Mesh.MeshSizeFromPoints", 0)
gmsh.option.setNumber("Mesh.MeshSizeExtendFromBoundary", 0)
gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", 0)
alanlar = []
for ad, h in [("KALLUS", a.kallus_boyu), ("VIDA", a.vida_boyu), ("PLAK", a.kemik_boyu),
              ("ILIK", a.kemik_boyu), ("KORTEKS", a.kemik_boyu)]:
    f = gmsh.model.mesh.field.add("Constant")
    gmsh.model.mesh.field.setNumbers(f, "VolumesList", [t for t, b in bolge.items() if b == ad])
    gmsh.model.mesh.field.setNumber(f, "VIn", h)
    gmsh.model.mesh.field.setNumber(f, "VOut", 1e3)
    gmsh.model.mesh.field.setNumber(f, "IncludeBoundary", 1)
    alanlar.append(f)
fm = gmsh.model.mesh.field.add("Min")
gmsh.model.mesh.field.setNumbers(fm, "FieldsList", alanlar)
gmsh.model.mesh.field.setAsBackgroundMesh(fm)
gmsh.option.setNumber("Mesh.ElementOrder", 2)
gmsh.option.setNumber("Mesh.SecondOrderLinear", 0)
gmsh.option.setNumber("Mesh.Optimize", 1)
gmsh.option.setNumber("Mesh.HighOrderOptimize", 0)
gmsh.model.mesh.generate(3)

# --- dugumler
ntags, ncoord, _ = gmsh.model.mesh.getNodes()
ncoord = ncoord.reshape(-1, 3)
# yalnizca 3B elemanlarda kullanilan dugumler, 1..N yeniden numara
elemler = {}
kullanilan = set()
for ad in oncelik:
    conn_all = []
    for t in [t for t, b in bolge.items() if b == ad]:
        et, etags, enodes = gmsh.model.mesh.getElements(3, t)
        for typ, en in zip(et, enodes):
            assert typ == 11, f"beklenmeyen eleman tipi {typ}"  # 11 = 10 dugumlu tet
            conn_all.append(np.asarray(en, dtype=np.int64).reshape(-1, 10))
    c = np.vstack(conn_all)
    # gmsh tet10 -> Abaqus/CalculiX C3D10: gmsh 8=(2,3), 9=(1,3); Abaqus 8=(1,3) (0-tabanli 8), 9=(2,3)
    c = c[:, [0, 1, 2, 3, 4, 5, 6, 7, 9, 8]]
    elemler[ad] = c
    kullanilan.update(np.unique(c).tolist())
tag2idx = {int(t): i for i, t in enumerate(ntags)}
eski = np.array(sorted(kullanilan), dtype=np.int64)
yeni = {int(t): i + 1 for i, t in enumerate(eski)}
X = np.array([ncoord[tag2idx[int(t)]] for t in eski])
for ad in elemler:
    elemler[ad] = np.vectorize(yeni.get)(elemler[ad])

# --- kallus-plak bagini kopar: plak elemanlarinda kallusla ortak dugumlerin ikizini kullan
ikiz_sayisi = 0
if not a.plak_bagli:
    ortak = np.intersect1d(np.unique(elemler["PLAK"]), np.unique(elemler["KALLUS"]))
    diger = np.unique(np.concatenate([elemler[k].ravel() for k in ("VIDA", "KORTEKS", "ILIK")]))
    assert len(np.intersect1d(ortak, diger)) == 0, "plak-kallus arayuzu baska bolgeye de degiyor"
    yeni_no = {int(n): len(X) + 1 + i for i, n in enumerate(ortak)}
    X = np.vstack([X, X[ortak - 1]])
    elemler["PLAK"] = np.vectorize(lambda n: yeni_no.get(int(n), int(n)))(elemler["PLAK"])
    ikiz_sayisi = len(ortak)
    assert len(np.intersect1d(np.unique(elemler["PLAK"]), np.unique(elemler["KALLUS"]))) == 0
print(f"Plak-kallus arayuzunde ikizlenen dugum: {ikiz_sayisi}")

# ara dugum kontrolu (C3D10 sirasi): 4=(0,1) 5=(1,2) 6=(2,0) 7=(0,3) 8=(1,3) 9=(2,3)
kenar = [(0, 1), (1, 2), (2, 0), (0, 3), (1, 3), (2, 3)]
c = elemler["KALLUS"][:200] - 1
for k, (i, j) in enumerate(kenar):
    orta = 0.5 * (X[c[:, i]] + X[c[:, j]])
    assert np.abs(X[c[:, 4 + k]] - orta).max() < 0.2, f"ara dugum sirasi hatali (kenar {k})"
# isaretli hacim > 0 kontrolu (C++ Plane_intersection yon varsayimi)
def hacimler(c):
    c = c - 1
    return np.einsum("ij,ij->i", np.cross(X[c[:, 1]] - X[c[:, 0]], X[c[:, 2]] - X[c[:, 0]]), X[c[:, 3]] - X[c[:, 0]]) / 6
for ad in elemler:
    v = hacimler(elemler[ad])
    assert (v > 0).all(), f"{ad}: {(v <= 0).sum()} negatif hacimli eleman"

# --- eleman numaralari: kallus 1..Nk (C++ FIRST_CALLUS_ELEMENT = 1), sonra digerleri
etiket = {}
sayac = 1
for ad in ["KALLUS", "KORTEKS", "ILIK", "PLAK", "VIDA"]:
    n = len(elemler[ad]); etiket[ad] = np.arange(sayac, sayac + n); sayac += n
N_NODE, N_KAL = len(X), len(elemler["KALLUS"])

# sinir dugum kumeleri
zmin, zmax = X[:, 2].min(), X[:, 2].max()
kem_dug = np.unique(np.concatenate([elemler["KORTEKS"].ravel(), elemler["ILIK"].ravel()]))
distal = [n for n in kem_dug if abs(X[n - 1, 2] - zmin) < 1e-6]
proks = [n for n in kem_dug if abs(X[n - 1, 2] - zmax) < 1e-6]
print(f"Dugum {N_NODE}, kallus eleman {N_KAL}, toplam eleman {sayac-1}, distal {len(distal)}, proksimal {len(proks)} yuz dugumu")

def satirlar(liste, n=16):
    return "\n".join(", ".join(str(v) for v in liste[i:i + n]) for i in range(0, len(liste), n))

ref, rot = N_NODE + 1, N_NODE + 2
with open(os.path.join(a.cikti, "model_sablon.inp"), "w") as f:
    f.write("** mechanobio_bone_2 (main dali) - koyun uzun kemigi 30 mm defekt, CalculiX sablonu\n")
    f.write("** uzun_kemik_geometri.py ile uretildi. Kallus malzemeleri ve adim C++ Update_model tarafindan eklenir.\n")
    f.write("*NODE, NSET=NALL\n")
    for i, x in enumerate(X):
        f.write(f"{i+1}, {x[0]:.6f}, {x[1]:.6f}, {x[2]:.6f}\n")
    f.write(f"{ref}, 0., 0., {zmax:.6f}\n{rot}, 0., 0., {zmax:.6f}\n")
    for ad in ["KALLUS", "KORTEKS", "ILIK", "PLAK", "VIDA"]:
        f.write(f"*ELEMENT, TYPE=C3D10, ELSET={ad}\n")
        for e, c in zip(etiket[ad], elemler[ad]):
            f.write(f"{e}, " + ", ".join(str(v) for v in c) + "\n")
    f.write("*NSET, NSET=DISTAL\n" + satirlar(distal) + "\n")
    f.write("*NSET, NSET=PROKSIMAL\n" + satirlar(proks) + "\n")
    f.write(f"*NSET, NSET=REF\n{ref}\n*NSET, NSET=ROT\n{rot}\n")
    f.write("** sabit malzemeler [Perier-Metz 2020 Tablo 3; celik 210 GPa]\n")
    for ad, E, nu in [("KORTEKS", 17000., 0.3), ("ILIK", 2., 0.167), ("PLAK", 210000., 0.3), ("VIDA", 210000., 0.3)]:
        f.write(f"*MATERIAL, NAME=M_{ad}\n*ELASTIC\n{E}, {nu}\n*SOLID SECTION, ELSET={ad}, MATERIAL=M_{ad}\n")
    f.write("** proksimal uc: rijit govde, referans noktasi (Abaqus m_Set-2 karsiligi)\n")
    f.write(f"*RIGID BODY, NSET=PROKSIMAL, REF NODE={ref}, ROT NODE={rot}\n")
    f.write("** BC-1: distal ankastre (m_Set-1, ENCASTRE)\n*BOUNDARY\nDISTAL, 1, 3\n")
    f.write("** BC-2: m_Set-2 DOF 1, 2, 6\n*BOUNDARY\nREF, 1, 2\nROT, 3, 3\n")
    f.write("** ---- buradan sonrasi C++ (Update_model) tarafindan eklenir ----\n")

with open(os.path.join(a.cikti, "node_file.txt"), "w") as f:
    for i, x in enumerate(X):
        f.write(f"{i+1}, {x[0]:.6f}, {x[1]:.6f}, {x[2]:.6f}\n")
with open(os.path.join(a.cikti, "element_file.txt"), "w") as f:
    for e, c in zip(etiket["KALLUS"], elemler["KALLUS"]):
        f.write(f"{e}, " + ", ".join(str(v) for v in c) + "\n")
with open(os.path.join(a.cikti, "model_bilgi.h"), "w") as f:
    f.write(f"// uzun_kemik_geometri.py tarafindan uretildi\n#pragma once\n"
            f"constexpr int NUMBER_NODES = {N_NODE};\nconstexpr int NUMBER_ELEMS = {N_KAL}; // kallus elemanlari\n")

# ParaView icin
import meshio
cells, reg = [], []
for k, ad in enumerate(["KALLUS", "KORTEKS", "ILIK", "PLAK", "VIDA"]):
    cells.append(("tetra10", (elemler[ad][:, [0, 1, 2, 3, 4, 5, 6, 7, 9, 8]] - 1)))
    reg.append(np.full(len(elemler[ad]), k))
meshio.write(os.path.join(a.cikti, "ag.vtu"), meshio.Mesh(X, cells, cell_data={"bolge": reg}))

ozet = dict(plak_kallus_bagli=a.plak_bagli, ikizlenen_dugum=ikiz_sayisi, kallus_boyu=a.kallus_boyu, kemik_boyu=a.kemik_boyu, dugum=N_NODE, kallus_eleman=N_KAL,
            toplam_eleman=int(sayac - 1), hacim_mm3=hacim, kallus_sinir_kutusu=bbk,
            kallus_hacim_kontrol=float(hacimler(elemler["KALLUS"]).sum()))
json.dump(ozet, open(os.path.join(a.cikti, "ag_ozeti.json"), "w"), indent=1, ensure_ascii=False)
print(json.dumps(ozet, indent=1, ensure_ascii=False))
gmsh.finalize()
