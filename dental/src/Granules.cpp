// Copyright 2026 Melih Marangoz. Part of SilicoGraft's dental socket model; GNU AGPL-3.0 (see LICENSE and NOTICE).
// [DENTAL] beta-TCP granules as explicit spheres on the lattice (lattice code 12, as the upstream scaffold).
//
// Packing: random sequential addition of spheres with diameters uniform in [granule_dmin, granule_dmax] mm,
// largest first, centres on free socket points, at most granule_overlap interpenetration (as a fraction of the
// sum of radii; random addition of hard spheres jams near 0.38), until granule_fraction of the socket points are
// granule (the granule envelope: intra-granular micro-porosity is below the 0.1 mm lattice). Spheres are cut by
// the socket wall and the crest plane (only socket points become granule).
// Resorption: each granule keeps its centre and shrinks with its volume decaying first-order,
// V = V0 exp(-tcp_k (t - tcp_lag)) for t > tcp_lag, i.e. r = r0 exp(-tcp_k (t - tcp_lag) / 3). A granule point is freed
// (empty, available to cells) when its distance to the centre exceeds the current radius.
#include <cmath>
#include <iostream>
#include <fstream>
#include <vector>
#include <random>
#include <algorithm>
#include "header.h"

using namespace std;

namespace {
struct Granule { float x, y, z, r0; };
vector<Granule> granules;
struct GPoint { int i, j, k; float s; }; // s = distance to its granule's centre / r0
vector<GPoint> gpoints;
}

long Place_granules(char lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], int lpe[LATTICE_X][LATTICE_Y][LATTICE_Z])
{
	granules.clear(); gpoints.clear();
	if (P.granule_fraction <= 0) return 0;
	const unsigned pat = P.granule_pattern >= 0 ? (unsigned)P.granule_pattern : g_run_seed + 1000u;
	std::mt19937 rng(pat);
	std::uniform_real_distribution<double> U(0.0, 1.0);
	// [DENTAL] optional graft_mask.raw (models with several sockets): only its points are grafted, and
	// granule_fraction refers to them
	vector<unsigned char> gmask;
	{
		ifstream gm("graft_mask.raw", ios::binary);
		if (gm) {
			gmask.assign((size_t)LATTICE_X * LATTICE_Y * LATTICE_Z, 0);
			gm.read(reinterpret_cast<char*>(gmask.data()), gmask.size());
		}
	}
	auto graftable = [&](int i, int j, int k) {
		return gmask.empty() || gmask[((size_t)i * LATTICE_Y + j) * LATTICE_Z + k] != 0;
	};
	vector<int> free_pts; // socket points (flat index)
	long socket = 0;
	for (int i = 0; i < LATTICE_X; i++)
		for (int j = 0; j < LATTICE_Y; j++)
			for (int k = 0; k < LATTICE_Z; k++)
				if (lpe[i][j][k] != 0 && graftable(i, j, k) && is_socket_point(lattice[i][j][k])) {
					socket++; if (lattice[i][j][k] == 0) free_pts.push_back((i * LATTICE_Y + j) * LATTICE_Z + k); }
	if (free_pts.empty()) { cout << "  Granules: no graftable socket points" << endl; return 0; }
	const double target_pts = P.granule_fraction * socket;
	// candidate diameters: enough sphere volume for 1.6 x the target, sorted largest first
	vector<double> radii;
	double vol = 0, vox = 1e-3; // mm3 per lattice point
	while (vol < 1.6 * target_pts * vox) {
		const double d = P.granule_dmin + (P.granule_dmax - P.granule_dmin) * U(rng);
		radii.push_back(d / 2); vol += M_PI / 6 * d * d * d;
	}
	sort(radii.rbegin(), radii.rend());
	vector<int> owner((size_t)LATTICE_X * LATTICE_Y * LATTICE_Z, -1);
	long placed_pts = 0;
	const int tries = 400;
	for (double r : radii) {
		if (placed_pts >= target_pts) break;
		for (int t = 0; t < tries; t++) {
			const int f = free_pts[(size_t)(U(rng) * free_pts.size())];
			const int i0 = f / (LATTICE_Y * LATTICE_Z), j0 = (f / LATTICE_Z) % LATTICE_Y, k0 = f % LATTICE_Z;
			if (lattice[i0][j0][k0] != 0) continue;
			const float cx = LATTICE_ORIGIN_X + i0 * CELL_DIAMETER, cy = LATTICE_ORIGIN_Y + j0 * CELL_DIAMETER, cz = LATTICE_ORIGIN_Z + k0 * CELL_DIAMETER;
			bool ok = true;
			for (const Granule& g : granules) {
				const double dx = cx - g.x, dy = cy - g.y, dz = cz - g.z;
				if (sqrt(dx * dx + dy * dy + dz * dz) < (1.0 - P.granule_overlap) * (r + g.r0)) { ok = false; break; }
			}
			if (!ok) continue;
			const int id = (int)granules.size();
			granules.push_back({cx, cy, cz, (float)r});
			const int R = (int)ceil(r / CELL_DIAMETER);
			for (int i = max(0, i0 - R); i <= min(LATTICE_X - 1, i0 + R); i++)
				for (int j = max(0, j0 - R); j <= min(LATTICE_Y - 1, j0 + R); j++)
					for (int k = max(0, k0 - R); k <= min(LATTICE_Z - 1, k0 + R); k++) {
						if (lpe[i][j][k] == 0 || lattice[i][j][k] != 0 || !graftable(i, j, k)) continue; // socket points not yet taken
						const double dx = (i - i0) * CELL_DIAMETER, dy = (j - j0) * CELL_DIAMETER, dz = (k - k0) * CELL_DIAMETER;
						const double d = sqrt(dx * dx + dy * dy + dz * dz);
						if (d > r) continue;
						lattice[i][j][k] = LATTICE_GRANULE;
						owner[((size_t)i * LATTICE_Y + j) * LATTICE_Z + k] = id;
						gpoints.push_back({i, j, k, (float)(d / r)});
						placed_pts++;
					}
			break;
		}
	}
	ofstream gf("granules.csv");
	gf << "x,y,z,r0\n";
	for (const Granule& g : granules) gf << g.x << "," << g.y << "," << g.z << "," << g.r0 << "\n";
	cout << "  Granules: " << granules.size() << " placed, " << placed_pts << " points = " << 100.0 * placed_pts / socket
	     << " % of the socket (target " << 100 * P.granule_fraction << " %), pattern seed " << pat << endl;
	return placed_pts;
}

long Resorb_granules(char lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], short age[LATTICE_X][LATTICE_Y][LATTICE_Z], int iter)
{
	// [DENTAL] real days (time_scale real days per iteration); tcp_k and tcp_lag are per real day
	const double day_end = (double)(iter + 1) * P.time_scale;
	if (gpoints.empty() || day_end <= P.tcp_lag) return 0;
	// log of the remaining volume fraction: first order from tcp_lag; biphasic with tcp_k2 after tcp_k_switch
	double lnV = -P.tcp_k * (day_end - P.tcp_lag);
	if (P.tcp_k2 >= 0 && day_end > P.tcp_k_switch && P.tcp_k_switch > P.tcp_lag)
		lnV = -P.tcp_k * (P.tcp_k_switch - P.tcp_lag) - P.tcp_k2 * (day_end - P.tcp_k_switch);
	const float smax = (float)exp(lnV / 3.0); // radius factor at the end of this day
	long freed = 0;
	size_t w = 0;
	for (size_t n = 0; n < gpoints.size(); n++) {
		const GPoint& g = gpoints[n];
		if (g.s > smax) {
			if (lattice[g.i][g.j][g.k] == LATTICE_GRANULE) { lattice[g.i][g.j][g.k] = 0; age[g.i][g.j][g.k] = 0; freed++; }
		} else gpoints[w++] = g;
	}
	gpoints.resize(w);
	return freed;
}
