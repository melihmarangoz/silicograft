#!/bin/bash
# ilk gun (tum kallus granulasyon) FE cozumu: bagli ve bagsiz plak
set -e
cd ~/mechanobio
python3 geometri/uzun_kemik_geometri.py --kallus-boyu 1.7 --plak-bagli --cikti ~/kosular/ag_h1.7_bagli > /dev/null
for ag in bagli bagsiz; do
  d=~/kosular/ilkgun_$ag; mkdir -p $d; cd $d
  cp ~/kosular/ag_h1.7_$ag/model_sablon.inp t.inp
  cat >> t.inp <<'X'
*MATERIAL, NAME=M_GRAN
*ELASTIC
0.2, 0.167
*SOLID SECTION, ELSET=KALLUS, MATERIAL=M_GRAN
*STEP
*STATIC
*CLOAD
REF, 3, -823.
ROT, 2, 9777.
*EL PRINT, ELSET=KALLUS
S, E
*NODE PRINT, NSET=REF
U
*END STEP
X
  OMP_NUM_THREADS=8 ccx t > log.txt 2>&1 &
done
wait
for ag in bagli bagsiz; do
python3 - $ag <<'P'
import numpy as np, sys, os
ag=sys.argv[1]; L=open(os.path.expanduser(f"~/kosular/ilkgun_{ag}/t.dat")).read().splitlines()
def tab(t):
    i=[k for k,l in enumerate(L) if t in l][-1]; rows=[]
    for l in L[i+1:]:
        if "(" in l: break
        p=l.split()
        if len(p)==8: rows.append([float(x) for x in p])
    return np.array(rows)
S=tab("stresses (elem"); E=tab("strains (elem")
el=S[:,0].astype(int)
hp=np.bincount(el,-(S[:,2]+S[:,3]+S[:,4])/3)[1:]/4
M=np.zeros((len(E),3,3)); e=E[:,2:]
M[:,0,0],M[:,1,1],M[:,2,2]=e[:,0],e[:,1],e[:,2]
M[:,0,1]=M[:,1,0]=e[:,3]; M[:,0,2]=M[:,2,0]=e[:,4]; M[:,1,2]=M[:,2,1]=e[:,5]
emin=np.bincount(E[:,0].astype(int),np.linalg.eigvalsh(M)[:,0])[1:]/4
u=[l for l in L if l.strip().startswith(str(int(L[-1].split()[0])) if L[-1].split() else "x")]
rez=(np.abs(hp)<0.0016)&(np.abs(emin)<0.0004); kem=~rez&(np.abs(hp)<0.15)&(np.abs(emin)<0.05)
kik_o=~rez&~kem&(hp<-0.15)&(np.abs(emin)<0.15); kik_c=~rez&~kem&(hp>0.15)&(np.abs(emin)<0.15)
print(f"{ag:7s} | max|emin| {np.abs(emin).max():.4f} | HP min {hp.min():.3f} max {hp.max():.3f} MPa | HP>+0.15: {(hp>0.15).sum()} | HP<-0.15: {(hp<-0.15).sum()} | uyaran %: rez {100*rez.mean():.1f} kemik {100*kem.mean():.1f} kik(orij) {100*kik_o.mean():.1f} kik(claes) {100*kik_c.mean():.1f}")
P
grep -A3 displacements ~/kosular/ilkgun_$ag/t.dat | tail -1
done
