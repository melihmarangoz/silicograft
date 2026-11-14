// Modified by Melih Marangoz in 2026 for the dental socket model (changes marked [DENTAL]; see NOTICE).
// [DENTAL] Upstream seeded MSCs in the marrow cavity and along the periosteum of the long bone. The socket
// model reads its initial lattice from lattice_init.raw, written by dental/geometry/socket_geometry.py:
//   0  socket point (blood clot / granulation tissue, free for cells)
//   11 native alveolar bone
//   14 soft-tissue cover above the crest (closed flap)
// The analytic socket of the geometry script and the socket elements differ slightly at the wall (the
// elements have planar faces). The FE mesh decides: points inside a socket element are socket points
// (free); points outside are bone, or cover above the crest. MSCs are then seeded in the wall lining:
// SEED_FRACTION of the socket points within LINING_VOXELS of a native bone point (fixed pattern seed).
#include <cstdlib>
#include <iostream>
#include <fstream>
#include <vector>
#include <random>
#include "header.h"

using namespace std;

bool Initialize_lattice(char initial_lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], short initial_age[LATTICE_X][LATTICE_Y][LATTICE_Z],
	int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z])
{
    const size_t n = (size_t)LATTICE_X * LATTICE_Y * LATTICE_Z;
    vector<unsigned char> init(n);
    ifstream f("lattice_init.raw", ios::binary);
    if (!f || !f.read(reinterpret_cast<char*>(init.data()), n) || f.peek() != EOF) {
        cerr << "ERROR: lattice_init.raw missing or not " << n << " bytes (model_info.h and the mesh must match)." << endl;
        return false;
    }
    long socket = 0, seeded = 0, socket_was_bone = 0, free_outside = 0;
    size_t idx = 0;
    for (int i = 0; i < LATTICE_X; i++)
        for (int j = 0; j < LATTICE_Y; j++)
            for (int k = 0; k < LATTICE_Z; k++, idx++) {
                const unsigned char c = init[idx];
                initial_age[i][j][k] = 666; // as upstream main.cpp: non-cell points carry age 666
                if (lattice_point_element[i][j][k] != 0) {
                    socket++;
                    initial_lattice[i][j][k] = 0;
                    if (c != 0) socket_was_bone++;
                } else {
                    const float z = LATTICE_ORIGIN_Z + k * CELL_DIAMETER; // crest at z = 0
                    if (c == (unsigned char)LATTICE_COVER || z > -0.1f) initial_lattice[i][j][k] = LATTICE_COVER; // never bone over the opening
                    else {
                        initial_lattice[i][j][k] = LATTICE_BONE;
                        if (c == 0) free_outside++;
                    }
                }
            }
    // seeding of the wall lining
    std::mt19937 pattern(SEED_PATTERN);
    std::uniform_real_distribution<double> U(0.0, 1.0);
    const int L = LINING_VOXELS;
    long lining = 0;
    for (int i = 0; i < LATTICE_X; i++)
        for (int j = 0; j < LATTICE_Y; j++)
            for (int k = 0; k < LATTICE_Z; k++) {
                if (lattice_point_element[i][j][k] == 0) continue;
                bool near_bone = false;
                for (int di = -L; di <= L && !near_bone; di++)
                    for (int dj = -L; dj <= L && !near_bone; dj++)
                        for (int dk = -L; dk <= L && !near_bone; dk++) {
                            if (di*di + dj*dj + dk*dk > L*L) continue;
                            const int a = i+di, b = j+dj, c = k+dk;
                            if (a < 0 || b < 0 || c < 0 || a >= LATTICE_X || b >= LATTICE_Y || c >= LATTICE_Z) continue;
                            if (initial_lattice[a][b][c] == LATTICE_BONE) near_bone = true;
                        }
                if (!near_bone) continue;
                lining++;
                if (U(pattern) < SEED_FRACTION) { initial_lattice[i][j][k] = 1; initial_age[i][j][k] = 1; seeded++; } // MSC, age 1 as upstream
            }
    cout << "  Socket lattice points: " << socket << " (" << socket * 1e-3 << " mm3), wall lining " << lining
         << ", seeded MSCs: " << seeded << endl;
    cout << "  Reconciled with the mesh: " << socket_was_bone << " points inside socket elements were bone/cover in lattice_init.raw, "
         << free_outside << " socket points of lattice_init.raw lie outside the elements and became bone." << endl;
    return true;
}
