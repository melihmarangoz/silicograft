// Modified by Melih Marangoz in 2026 for the dental socket model (changes marked [DENTAL]; see NOTICE).
#include <fstream>
#include <iostream>
#include "header.h"

using namespace std;

// [DENTAL] Upstream put the lattice origin at the minimum corner of the callus mesh. The socket lattice also
// needs the bony wall and the cover around the socket, so the origin and size are fixed by the geometry
// script (model_info.h: LATTICE_ORIGIN_*, LATTICE_X/Y/Z). Here we only check that every socket node lies
// inside the lattice box.
void Calculate_lattice(int lattice_element[NUMBER_ELEMS][NODES_PER_ELEM], float lattice_node_position[NUMBER_NODES][3], float Global_min[3], float Global_max[3])
{
    Global_min[0] = LATTICE_ORIGIN_X;
    Global_min[1] = LATTICE_ORIGIN_Y;
    Global_min[2] = LATTICE_ORIGIN_Z;
    Global_max[0] = LATTICE_ORIGIN_X + (LATTICE_X - 1) * CELL_DIAMETER;
    Global_max[1] = LATTICE_ORIGIN_Y + (LATTICE_Y - 1) * CELL_DIAMETER;
    Global_max[2] = LATTICE_ORIGIN_Z + (LATTICE_Z - 1) * CELL_DIAMETER;

    int outside = 0;
    for (int element = 0; element < NUMBER_ELEMS; element++)
        for (int j = 0; j < NODES_PER_ELEM; j++) {
            const int node = lattice_element[element][j];
            for (int d = 0; d < 3; d++) {
                const float x = lattice_node_position[node-1][d];
                if (x < Global_min[d] - 1e-4f || x > Global_max[d] + 1e-4f) { outside++; break; }
            }
        }
    if (outside > 0)
        cerr << "WARNING: " << outside << " socket element nodes lie outside the lattice box." << endl;
}
