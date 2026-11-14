// Copyright 2026 Melih Marangoz. Part of SilicoGraft's CalculiX port of mechanobio_bone_2; GNU AGPL-3.0 (see LICENSE and NOTICE).
// [CCX] Daily summary: cell/tissue counts at the socket lattice points and the element stimulus counts.
// Not in the upstream code; it only reads and does not change the model.
// [DENTAL] English column names; day = iteration + 1 (state after that many daily iterations).
#include <fstream>
#include <filesystem>
#include "header.h"

using namespace std;

void Write_statistics(char const lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z],
	char const stimulus[NUMBER_ELEMS], int iter)
{
	long n[16] = {0};
	long socket = 0;
	for (int i = 0; i < LATTICE_X; i++)
		for (int j = 0; j < LATTICE_Y; j++)
			for (int k = 0; k < LATTICE_Z; k++) {
				const int c = lattice[i][j][k];
				if (lattice_point_element[i][j][k] != 0) {
					socket++;
					if (c >= 0 && c < 16) n[c]++;
				}
			}
	long st[6] = {0};
	for (int e = 0; e < NUMBER_ELEMS; e++) if (stimulus[e] >= 0 && stimulus[e] < 6) st[(int)stimulus[e]]++;
	const bool header = !std::filesystem::exists("statistics.csv");
	ofstream f("statistics.csv", ios::app);
	if (header)
		f << "iteration,day,socket_points,empty,MSC,bone,cartilage,fibrous,"
		     "stim_resorption,stim_bone,stim_cartilage,stim_fibrous\n";
	f << iter << "," << iter + 1 << "," << socket << "," << n[0] << "," << n[1] << "," << n[2] << "," << n[4] << "," << n[5] << ","
	  << st[1] << "," << st[2] << "," << st[4] << "," << st[5] << "\n";
	ofstream g("stimulus_" + to_string(iter) + ".bin", ios::binary);
	g.write(stimulus, NUMBER_ELEMS);
}
