// Copyright 2026 Melih Marangoz. Part of SilicoGraft's dental socket model; GNU AGPL-3.0 (see LICENSE and NOTICE).
// [DENTAL] Helpers shared by the cell rules.
#include <cmath>
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
// soft-tissue cover over the socket opening (LATTICE_COVER) is not a guiding surface unless
// -DSG_COVER_GUIDES is given.
bool Neighbour_guides(char v)
{
#ifdef SG_COVER_GUIDES
	return v > 1 && v != 6;
#else
	return v > 1 && v != 6 && v != LATTICE_COVER;
#endif
}
