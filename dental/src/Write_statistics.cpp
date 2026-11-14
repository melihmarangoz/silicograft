// Copyright 2026 Melih Marangoz. Part of SilicoGraft's CalculiX port of mechanobio_bone_2; GNU AGPL-3.0 (see LICENSE and NOTICE).
// [CCX] Gunluk ozet: kallus kafes noktalarindaki hucre/doku sayilari ve eleman uyaran dagilimi.
// Orijinal kodda yok; yalnizca okuma yapar, model davranisini degistirmez.
#include <fstream>
#include <filesystem>
#include "header.h"

using namespace std;

void Write_statistics(char const lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z],
	char const stimulus[NUMBER_ELEMS], int iter)
{
	long n[14] = {0};
	long callus = 0, msc_marrow = 0;
	for (int i = 0; i < LATTICE_X; i++)
		for (int j = 0; j < LATTICE_Y; j++)
			for (int k = 0; k < LATTICE_Z; k++) {
				const int c = lattice[i][j][k];
				if (lattice_point_element[i][j][k] != 0) {
					callus++;
					if (c >= 0 && c < 14) n[c]++;
				} else if (c == 1) msc_marrow++;
			}
	long st[6] = {0};
	for (int e = 0; e < NUMBER_ELEMS; e++) if (stimulus[e] >= 0 && stimulus[e] < 6) st[(int)stimulus[e]]++;
	const bool header = !std::filesystem::exists("istatistik.csv");
	ofstream f("istatistik.csv", ios::app);
	if (header)
		f << "gun,kallus_nokta,bos,MSC,kemik,kikirdak,fibroz,MSC_kallus_disi,"
		     "uyaran_rezorpsiyon,uyaran_kemik,uyaran_kikirdak,uyaran_fibroz\n";
	f << iter << "," << callus << "," << n[0] << "," << n[1] << "," << n[2] << "," << n[4] << "," << n[5] << ","
	  << msc_marrow << "," << st[1] << "," << st[2] << "," << st[4] << "," << st[5] << "\n";
	// eleman bazinda uyaran (gorsellestirme icin, ~NUMBER_ELEMS bayt)
	ofstream g("stimulus_" + to_string(iter) + ".bin", ios::binary);
	g.write(stimulus, NUMBER_ELEMS);
}
