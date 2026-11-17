// Modified by Melih Marangoz in 2026 for the dental socket model (changes marked [DENTAL]; see NOTICE).
// [DENTAL] Upstream seeded MSCs in the marrow cavity and along the periosteum of the long bone. The socket
// model reads its initial lattice from lattice_init.raw, written by dental/geometry/socket_geometry.py:
//   0  socket point (blood clot / granulation tissue, free for cells)
//   11 native alveolar bone
//   14 soft-tissue cover above the crest (closed flap)
// The analytic socket of the geometry script and the socket elements differ slightly at the wall (the
// elements have planar faces). The FE mesh decides: points inside a socket element are socket points
// (free); points outside are bone, or cover above the crest. MSCs are then seeded in the wall lining:
// P.seed_fraction of the socket points within P.lining_voxels of a native bone point (fixed pattern seed);
// with P.cover_source also along the soft-tissue cover (periosteum of the coronally advanced flap).
#include <cstdlib>
#include <iostream>
#include <fstream>
#include <vector>
#include <random>
#include <string>
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
#ifdef SG_INIT_DECIDES
                    // [DENTAL] model from segmentation masks: elements are coarser than the socket outline, so
                    // lattice_init.raw decides inside them too (0 socket, 11 native bone, 14 cover / soft tissue)
                    if (c == (unsigned char)LATTICE_BONE || c == (unsigned char)LATTICE_COVER) { initial_lattice[i][j][k] = c; continue; }
#endif
                    socket++;
                    initial_lattice[i][j][k] = 0;
                    if (c != 0) socket_was_bone++;
                } else {
                    const float z = LATTICE_ORIGIN_Z + k * CELL_DIAMETER; // crest at z = 0
#ifdef SG_INIT_DECIDES
                    const bool over_opening = false; // [DENTAL] no crest plane in models from masks
#else
                    const bool over_opening = z > -0.1f;
#endif
                    if (c == (unsigned char)LATTICE_COVER || over_opening) initial_lattice[i][j][k] = LATTICE_COVER; // never bone over the opening
                    else {
                        initial_lattice[i][j][k] = LATTICE_BONE;
                        if (c == 0) free_outside++;
                    }
                }
            }
    // [DENTAL] optional implant_mask.raw: implant points (titanium) are set before granules and seeding; they are
    // occupied, guide like other surfaces, are not a cell source and are not socket points in any statistics
    {
        ifstream im("implant_mask.raw", ios::binary);
        if (im) {
            vector<unsigned char> imask((size_t)LATTICE_X * LATTICE_Y * LATTICE_Z, 0);
            if (!im.read(reinterpret_cast<char*>(imask.data()), imask.size())) { cerr << "ERROR: implant_mask.raw has the wrong size." << endl; return false; }
            long n_impl = 0; size_t q = 0;
            for (int i = 0; i < LATTICE_X; i++)
                for (int j = 0; j < LATTICE_Y; j++)
                    for (int k = 0; k < LATTICE_Z; k++, q++)
                        if (imask[q]) { initial_lattice[i][j][k] = LATTICE_IMPLANT; n_impl++; }
            cout << "  Implant points: " << n_impl << endl;
        }
    }
    // [DENTAL] beta-TCP granules (if any) take socket points before the seeding
    Place_granules(initial_lattice, lattice_point_element);
    // seeding of the wall lining
    std::mt19937 pattern(SEED_PATTERN);
    std::uniform_real_distribution<double> U(0.0, 1.0);
    const int L = P.lining_voxels;
    vector<char> wall_elem(NUMBER_ELEMS, 0);
    long lining = 0;
    for (int i = 0; i < LATTICE_X; i++)
        for (int j = 0; j < LATTICE_Y; j++)
            for (int k = 0; k < LATTICE_Z; k++) {
                if (lattice_point_element[i][j][k] == 0 || initial_lattice[i][j][k] != 0) continue; // socket point not taken by a granule
                bool near_bone = false;
                for (int di = -L; di <= L && !near_bone; di++)
                    for (int dj = -L; dj <= L && !near_bone; dj++)
                        for (int dk = -L; dk <= L && !near_bone; dk++) {
                            if (di*di + dj*dj + dk*dk > L*L) continue;
                            const int a = i+di, b = j+dj, c = k+dk;
                            if (a < 0 || b < 0 || c < 0 || a >= LATTICE_X || b >= LATTICE_Y || c >= LATTICE_Z) continue;
                            if (initial_lattice[a][b][c] == LATTICE_BONE || (P.cover_source && initial_lattice[a][b][c] == LATTICE_COVER)) near_bone = true;
                        }
                if (!near_bone) continue;
                lining++;
                wall_elem[lattice_point_element[i][j][k] - 1] = 1; // [DENTAL] element at the bony wall
                if (U(pattern) < P.seed_fraction) { initial_lattice[i][j][k] = 1; initial_age[i][j][k] = 1; seeded++; } // MSC, age 1 as upstream
            }
    // [DENTAL] optional zone map (models from masks): per-point zone ids for zones.csv, names in zone_names.txt
    {
        ifstream zf("zone_map.raw", ios::binary);
        if (zf) {
            g_zone_map.assign(n, 0);
            if (!zf.read(reinterpret_cast<char*>(g_zone_map.data()), n)) { cerr << "ERROR: zone_map.raw is not " << n << " bytes." << endl; return false; }
            ifstream nf("zone_names.txt"); string nm;
            while (getline(nf, nm)) if (!nm.empty()) g_zone_names.push_back(nm);
            cout << "  Zone map: " << g_zone_names.size() << " zones" << endl;
        }
    }
    // [DENTAL] biological start of each element (main.cpp): a grafted socket's cells wait tcp_delay days, except in the
    // elements at the bony wall with tcp_wall_exempt
    long n_wall = 0, n_delayed = 0;
    for (int e = 0; e < NUMBER_ELEMS; e++) {
        n_wall += wall_elem[e];
        g_elem_start[e] = (P.granule_fraction > 0 && !(P.tcp_wall_exempt && wall_elem[e])) ? P.tcp_delay : 0;
        if (g_elem_start[e] > 0) n_delayed++;
    }
    cout << "  Wall elements: " << n_wall << " of " << NUMBER_ELEMS << "; delayed elements: " << n_delayed << endl;
    cout << "  Socket lattice points: " << socket << " (" << socket * 1e-3 << " mm3), wall lining " << lining
         << ", seeded MSCs: " << seeded << endl;
    cout << "  Reconciled with the mesh: " << socket_was_bone << " points inside socket elements were bone/cover in lattice_init.raw, "
         << free_outside << " socket points of lattice_init.raw lie outside the elements and became bone." << endl;
    return true;
}
