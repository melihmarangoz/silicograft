// Modified by Melih Marangoz in 2026 for the dental socket model (changes marked [DENTAL]; see NOTICE).
#include <cstdlib>
#include "header.h"

// [DENTAL] "neither empty nor MSC" is now Neighbour_guides(), which also leaves out the soft-tissue cover
bool Neighbour_presence(char cell_neighbour[LATTICE_X][LATTICE_Y][LATTICE_Z], int i_source, int j_source, int k_source,
	int i_dest, int j_dest, int k_dest) {

	// i-1
	if (i_source!=i_dest-1 && i_dest!=0 && Neighbour_guides(cell_neighbour[i_dest-1][j_dest][k_dest])) // neither empty nor MSC
		return true;

	// i+1
	if (i_source!=i_dest+1 && i_dest!=LATTICE_X-1 && Neighbour_guides(cell_neighbour[i_dest+1][j_dest][k_dest]))
		return true;

	// j-1
	if (j_source!=j_dest-1 && j_dest!=0 && Neighbour_guides(cell_neighbour[i_dest][j_dest-1][k_dest]))
		return true;

	// j+1
	if (j_source!=j_dest+1 && j_dest!=LATTICE_Y-1 && Neighbour_guides(cell_neighbour[i_dest][j_dest+1][k_dest]))
		return true;

	// k-1
	if (k_source!=k_dest-1 && k_dest!=0 && Neighbour_guides(cell_neighbour[i_dest][j_dest][k_dest-1]))
		return true;

	// k+1
	if (k_source!=k_dest+1 && k_dest!=LATTICE_Z-1 && Neighbour_guides(cell_neighbour[i_dest][j_dest][k_dest+1]))
		return true;

	return false; // the new position has no direct neighbour
}
