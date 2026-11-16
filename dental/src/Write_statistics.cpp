// Copyright 2026 Melih Marangoz. Part of SilicoGraft's CalculiX port of mechanobio_bone_2; GNU AGPL-3.0 (see LICENSE and NOTICE).
// [CCX] Daily summary: cell/tissue counts at the socket lattice points and the element stimulus counts.
// Not in the upstream code; it only reads and does not change the model.
// [DENTAL] English column names; day = iteration + 1 (state after that many daily iterations); zones.csv.
#include <fstream>
#include <filesystem>
#include <array>
#include <vector>
#include <string>
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
				if (lattice_point_element[i][j][k] != 0 && is_socket_point((char)c)) { // [DENTAL]
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
		     "stim_resorption,stim_bone,stim_cartilage,stim_fibrous,granule\n";
	const double day = (iter + 1) * P.time_scale; // [DENTAL] real days (prints as an integer when it is one)
	f << iter << "," << day << "," << socket << "," << n[0] << "," << n[1] << "," << n[2] << "," << n[4] << "," << n[5] << ","
	  << st[1] << "," << st[2] << "," << st[4] << "," << st[5] << "," << n[12] << "\n"; // [DENTAL] + granule
	if (P.raw_daily) {
		ofstream g("stimulus_" + to_string(iter) + ".bin", ios::binary);
		g.write(stimulus, NUMBER_ELEMS);
	}

	// [DENTAL] section_daily.bin: the central mesio-distal section (lattice plane y = 0) every day, appended as
	// LATTICE_X x LATTICE_Z bytes (x outer, z inner), for the live panel and section maps (4 kB per day).
	{
		ofstream sd("section_daily.bin", ios::binary | ios::app);
		for (int i = 0; i < LATTICE_X; i++) sd.write(&lattice[i][SECTION_J][0], LATTICE_Z);
	}

	// [DENTAL] zones.csv: Hong 2014's outcome every day. Socket points per third of the socket height
	// (crest z = 0 to SOCKET_Z_APEX) and in total, on the central section (lattice plane y = 0) and in the volume.
	const float h = -SOCKET_Z_APEX / 3.0f;
	// [DENTAL] zones: thirds of the idealized socket, or the ids of zone_map.raw (models from masks)
	const bool zmap = !g_zone_map.empty();
	const int NZ = zmap ? (int)g_zone_names.size() + 1 : 4; // last zone = total
	vector<array<array<long, 7>, 2>> cntv(NZ);
	for (auto& a2 : cntv) for (auto& a1 : a2) a1.fill(0);
	for (int i = 0; i < LATTICE_X; i++)
		for (int j = 0; j < LATTICE_Y; j++)
			for (int k = 0; k < LATTICE_Z; k++) {
				if (lattice_point_element[i][j][k] == 0 || !is_socket_point(lattice[i][j][k])) continue;
				int zone;
				if (zmap) {
					const int id = g_zone_map[((size_t)i * LATTICE_Y + j) * LATTICE_Z + k];
					if (id < 1 || id >= NZ) continue;
					zone = id - 1;
				} else {
					const float z = LATTICE_ORIGIN_Z + k * CELL_DIAMETER;
					zone = z < SOCKET_Z_APEX + h ? 0 : (z < SOCKET_Z_APEX + 2 * h ? 1 : 2);
				}
				const int c = lattice[i][j][k];
				const int col = c == 0 ? 1 : c == 1 ? 2 : c == 2 ? 3 : c == 4 ? 4 : c == 5 ? 5 : c == LATTICE_GRANULE ? 6 : -1;
				for (int r = 0; r < 2; r++) {
					if (r == 0 && j != SECTION_J) continue;
					for (int zz : {zone, NZ - 1}) {
						cntv[zz][r][0]++;
						if (col > 0) cntv[zz][r][col]++;
					}
				}
			}
	const bool zh = !std::filesystem::exists("zones.csv");
	ofstream z("zones.csv", ios::app);
	if (zh) z << "day,region,zone,points,empty,MSC,bone,cartilage,fibrous,granule\n";
	const char* region[2] = {"section", "volume"};
	vector<string> zname = {"apical", "middle", "coronal", "total"};
	if (zmap) { zname = g_zone_names; zname.push_back("total"); }
	for (int r = 0; r < 2; r++)
		for (int zz = 0; zz < NZ; zz++) {
			z << day << "," << region[r] << "," << zname[zz];
			for (int q = 0; q < 7; q++) z << "," << cntv[zz][r][q];
			z << "\n";
		}
}
