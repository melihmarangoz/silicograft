// Copyright 2026 Melih Marangoz. Part of SilicoGraft's dental socket model; GNU AGPL-3.0 (see LICENSE and NOTICE).
// [DENTAL] Runtime parameters (see struct Params in header.h): read from params.txt, echoed to params_used.txt.
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <map>
#include <functional>
#include "header.h"

using namespace std;

Params P;

bool Load_params(const char* file)
{
	map<string, function<void(istringstream&)>> set = {
		{"farfield_strain", [](istringstream& s) { s >> P.farfield_strain; }},
		{"force_stimulus", [](istringstream& s) { s >> P.force_stimulus; }},
		{"skip_fe_when_forced", [](istringstream& s) { s >> P.skip_fe_when_forced; }},
		{"stimulus_mode", [](istringstream& s) { s >> P.stimulus_mode; }},
		{"lower_window", [](istringstream& s) { s >> P.lower_window; }},
		{"activity_days", [](istringstream& s) { s >> P.activity_days; }},
		{"late_factor", [](istringstream& s) { s >> P.late_factor; }},
		{"seed_fraction", [](istringstream& s) { s >> P.seed_fraction; }},
		{"lining_voxels", [](istringstream& s) { s >> P.lining_voxels; }},
		{"cover_source", [](istringstream& s) { s >> P.cover_source; }},
		{"matrix_day", [](istringstream& s) { s >> P.matrix_day; }},
		{"remodel_rate", [](istringstream& s) { s >> P.remodel_rate; }},
		{"remodel_day", [](istringstream& s) { s >> P.remodel_day; }},
		{"raw_daily", [](istringstream& s) { s >> P.raw_daily; }},
	};
#ifdef FORCE_STIMULUS
	P.force_stimulus = FORCE_STIMULUS; // milestone-1 compile flag
#endif
#ifdef SG_COVER_GUIDES
	P.cover_source = 1;
#endif
	ifstream f(file);
	string line;
	int n = 0;
	while (f && getline(f, line)) {
		if (line.empty() || line[0] == '#') continue;
		istringstream ss(line);
		string key; ss >> key;
		auto it = set.find(key);
		if (it == set.end()) { cerr << "ERROR: unknown parameter '" << key << "' in " << file << endl; return false; }
		it->second(ss);
		if (ss.fail()) { cerr << "ERROR: bad value for '" << key << "' in " << file << endl; return false; }
		n++;
	}
	ofstream o("params_used.txt");
	o << "farfield_strain " << P.farfield_strain << "\nforce_stimulus " << P.force_stimulus
	  << "\nskip_fe_when_forced " << P.skip_fe_when_forced << "\nstimulus_mode " << P.stimulus_mode
	  << "\nlower_window " << P.lower_window << "\nactivity_days " << P.activity_days << "\nlate_factor " << P.late_factor
	  << "\nseed_fraction " << P.seed_fraction << "\nlining_voxels " << P.lining_voxels << "\ncover_source " << P.cover_source
	  << "\nmatrix_day " << P.matrix_day << "\nremodel_rate " << P.remodel_rate << "\nremodel_day " << P.remodel_day
	  << "\nraw_daily " << P.raw_daily << "\n";
	cout << "  Parameters: " << n << " set in " << file << " (all values in params_used.txt)" << endl;
	return true;
}
