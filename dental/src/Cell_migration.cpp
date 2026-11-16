// Modified by Melih Marangoz in 2026 for the CalculiX port and the dental socket model
// (changes marked [CCX] and [DENTAL]; see NOTICE).
/************************************************************
    Algorithm to migrate cells
        7 jumps each iteration (for lattice point size 100µm)
        (30 micrometers/hour)
        MSCs only (fibroblasts possible)
************************************************************/
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <cstdlib>
#include <cmath>
#include <vector>
#include <algorithm>
#include <iterator>
#include "header.h"

using namespace std;

// [DENTAL] Upstream also migrated the MSCs of the long-bone marrow cavity (a hard-coded ellipse in the bone
// ends). The socket model has no marrow reservoir: only MSCs inside socket elements migrate.
void Cell_migration(char cells_migration[LATTICE_X][LATTICE_Y][LATTICE_Z], short age_migration[LATTICE_X][LATTICE_Y][LATTICE_Z],
	int lattice_points_element[LATTICE_X][LATTICE_Y][LATTICE_Z], int iter)
{
    int i,j,k;
    int cell_type;
    int MSCs=0;
    int migrated=0;
    vector<Point> indices;
    const int max_jumps = 25; // change according to simulation cases
    int jumps = 0;
    int migration_histo[max_jumps];
    for (i=0;i<max_jumps;i++) {
    	migration_histo[i] = 0;
	}

    // Get total number of MSCs
    for (i=0;i<LATTICE_X;i++) {
        for (j=0;j<LATTICE_Y;j++) {
            for (k=0;k<LATTICE_Z;k++) {
                if (cells_migration[i][j][k]==1 && lattice_points_element[i][j][k]!=0) { // [DENTAL] an MSC in the socket
					MSCs += 1;
					Point temp = {i,j,k};
					indices.push_back(temp);
				}
            }
        }
    }

    std::shuffle(indices.begin(), indices.end(), rng()); // [CCX] random_shuffle was removed in C++17; shared engine

	for(Point& p:indices) {
	    i = p.x;
	    j = p.y;
	    k = p.z;

	    if (cells_migration[i][j][k]==1 && lattice_points_element[i][j][k]!=0) { // [DENTAL]
	        const int t = iter - g_elem_start[lattice_points_element[i][j][k]-1]; // [DENTAL] the cell's element clock
	        if (P.tcp_delay_all && t < 0) continue; // [DENTAL] cells of a delayed element wait
	        cell_type=1;
	        jumps = Jump_migration(cells_migration,i,j,k,age_migration,cell_type,lattice_points_element, std::max(t, 0));
	        migrated += 1;
	        if (jumps>-1 && jumps<max_jumps) { // add to histogram table
	        	migration_histo[jumps]++;
			}
		}
	}

	// Replace 6 by 1 for all migrated MSCs
    for (i=0;i<LATTICE_X;i++) {
        for (j=0;j<LATTICE_Y;j++) {
            for (k=0;k<LATTICE_Z;k++) {
                if (cells_migration[i][j][k]==6)
					cells_migration[i][j][k]=1;
            }
        }
    }

    // Write migration distribution to a file
    ofstream myfile;
	myfile.open("migration_distribution.txt", ios::app);
	for (i=0; i<max_jumps; i++) {
		myfile << migration_histo[i] << " ";
	}
	myfile << endl;
	myfile.close();

}
