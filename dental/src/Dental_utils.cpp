// Copyright 2026 Melih Marangoz. Part of SilicoGraft's dental socket model; GNU AGPL-3.0 (see LICENSE and NOTICE).
// [DENTAL] Helpers shared by the cell rules.
#include <cmath>
#include <algorithm>
#include "header.h"

// Number of cells, out of n, that proliferate, differentiate or die in one element at the given daily rate.
// Upstream truncates n*rate to an integer. With the long-bone mesh (~600 lattice points per element) the
// loss is small; with the socket mesh (~85 points per element) int(n*0.06) is 0 for n < 17, which would
// silently switch off the low post-day-15 rates. Stochastic rounding keeps the expected count at n*rate
// at any element size. -DSG_UPSTREAM_COUNTING restores the upstream truncation for comparison.
int sg_count(int n, double rate)
{
#ifdef SG_UPSTREAM_COUNTING
	return int(n * rate);
#else
	const double x = n * rate;
	int c = int(std::floor(x));
	const double frac = x - c;
	if (frac > 1e-9 && std::uniform_real_distribution<double>(0.0, 1.0)(rng()) < frac) c++;
	return c;
#endif
}

// Upstream: any non-empty lattice value except an MSC (1) or a just-migrated MSC (6) guides migration and
// allows differentiation (surface-guided migration and ECM deposition). In the socket model the
// soft-tissue cover over the socket opening (LATTICE_COVER) guides only when it is a cell source
// (P.cover_source = 1, or the milestone-1 flag -DSG_COVER_GUIDES).
bool Neighbour_guides(char v)
{
	// [DENTAL] granules guide like the upstream scaffold unless switched off or not yet (P.tcp_guide_day)
	if (v == LATTICE_GRANULE && (!P.tcp_guides || g_iter < P.tcp_guide_day)) return false;
	if (P.cover_source) return v > 1 && v != 6;
	return v > 1 && v != 6 && v != LATTICE_COVER;
}

// Early activity factor in a grafted socket (literature check 2026-11-16: beta-TCP sockets form 0.2-0.45 of the
// empty socket's bone at 2 weeks). While iter < tcp_inhibit_days the differentiation (and, with
// tcp_inhibit_prolif, the proliferation) rates of an element are multiplied by
//   1 - (1 - tcp_diff_mult) * min(1, granule share of the element / granule_fraction)   (tcp_inhibit_graded 1)
// so the factor is tcp_diff_mult where the granules are still packed and rises to 1 as they resorb.
int g_elem_start[NUMBER_ELEMS] = {0};

double tcp_activity_factor(long granule_points, long element_points, int iter)
{
	if (P.granule_fraction <= 0 || iter >= P.tcp_inhibit_days || P.tcp_diff_mult >= 1.0) return 1.0;
	if (!P.tcp_inhibit_graded) return P.tcp_diff_mult;
	const double share = element_points > 0 ? (double)granule_points / element_points : 0.0;
	return 1.0 - (1.0 - P.tcp_diff_mult) * std::min(1.0, share / P.granule_fraction);
}
