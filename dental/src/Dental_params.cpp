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
		{"remodel_day2", [](istringstream& s) { s >> P.remodel_day2; }},
		{"remodel_rate2", [](istringstream& s) { s >> P.remodel_rate2; }},
		{"tcp_inhibit_graded", [](istringstream& s) { s >> P.tcp_inhibit_graded; }},
		{"tcp_inhibit_prolif", [](istringstream& s) { s >> P.tcp_inhibit_prolif; }},
		{"tcp_wall_exempt", [](istringstream& s) { s >> P.tcp_wall_exempt; }},
		{"time_scale", [](istringstream& s) { s >> P.time_scale; }},
		{"tcp_k2", [](istringstream& s) { s >> P.tcp_k2; }},
		{"tcp_k_switch", [](istringstream& s) { s >> P.tcp_k_switch; }},
		{"iterations", [](istringstream& s) { s >> P.iterations; }},
		{"native_E", [](istringstream& s) { s >> P.native_E; }},
		{"bc_file", [](istringstream& s) { s >> P.bc_file; }},
		{"bc_file2", [](istringstream& s) { s >> P.bc_file2; }},
		{"bc_switch_day", [](istringstream& s) { s >> P.bc_switch_day; }},
		{"implant_E", [](istringstream& s) { s >> P.implant_E; }},
		{"implant_nu", [](istringstream& s) { s >> P.implant_nu; }},
		{"native_nu", [](istringstream& s) { s >> P.native_nu; }},
		{"raw_daily", [](istringstream& s) { s >> P.raw_daily; }},
		{"granule_fraction", [](istringstream& s) { s >> P.granule_fraction; }},
		{"granule_dmin", [](istringstream& s) { s >> P.granule_dmin; }},
		{"granule_dmax", [](istringstream& s) { s >> P.granule_dmax; }},
		{"granule_overlap", [](istringstream& s) { s >> P.granule_overlap; }},
		{"granule_pattern", [](istringstream& s) { s >> P.granule_pattern; }},
		{"tcp_k", [](istringstream& s) { s >> P.tcp_k; }},
		{"tcp_lag", [](istringstream& s) { s >> P.tcp_lag; }},
		{"tcp_E", [](istringstream& s) { s >> P.tcp_E; }},
		{"tcp_nu", [](istringstream& s) { s >> P.tcp_nu; }},
		{"tcp_guides", [](istringstream& s) { s >> P.tcp_guides; }},
		{"tcp_guide_day", [](istringstream& s) { s >> P.tcp_guide_day; }},
		{"tcp_late_mult", [](istringstream& s) { s >> P.tcp_late_mult; }},
		{"tcp_diff_mult", [](istringstream& s) { s >> P.tcp_diff_mult; }},
		{"tcp_inhibit_days", [](istringstream& s) { s >> P.tcp_inhibit_days; }},
		{"tcp_delay", [](istringstream& s) { s >> P.tcp_delay; }},
		{"tcp_delay_all", [](istringstream& s) { s >> P.tcp_delay_all; }},
		{"tcp_delay_activity", [](istringstream& s) { s >> P.tcp_delay_activity; }},
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
	  << "\nraw_daily " << P.raw_daily << "\ngranule_fraction " << P.granule_fraction << "\ngranule_dmin " << P.granule_dmin
	  << "\ngranule_dmax " << P.granule_dmax << "\ngranule_overlap " << P.granule_overlap << "\ngranule_pattern " << P.granule_pattern
	  << "\ntcp_k " << P.tcp_k << "\ntcp_lag " << P.tcp_lag << "\ntcp_E " << P.tcp_E << "\ntcp_nu " << P.tcp_nu
	  << "\ntcp_guides " << P.tcp_guides << "\ntcp_guide_day " << P.tcp_guide_day << "\ntcp_late_mult " << P.tcp_late_mult
	  << "\ntcp_diff_mult " << P.tcp_diff_mult << "\ntcp_inhibit_days " << P.tcp_inhibit_days
	  << "\ntcp_delay " << P.tcp_delay << "\ntcp_delay_all " << P.tcp_delay_all << "\ntcp_delay_activity " << P.tcp_delay_activity
	  << "\nremodel_day2 " << P.remodel_day2 << "\nremodel_rate2 " << P.remodel_rate2 << "\ntcp_inhibit_graded " << P.tcp_inhibit_graded
	  << "\ntcp_inhibit_prolif " << P.tcp_inhibit_prolif << "\ntcp_wall_exempt " << P.tcp_wall_exempt
	  << "\ntime_scale " << P.time_scale << "\ntcp_k2 " << P.tcp_k2 << "\ntcp_k_switch " << P.tcp_k_switch << "\niterations " << P.iterations << "\nnative_E " << P.native_E
	  << "\nnative_nu " << P.native_nu << "\n";
	if (!P.bc_file.empty()) o << "bc_file " << P.bc_file << "\n";
	if (!P.bc_file2.empty()) o << "bc_file2 " << P.bc_file2 << "\nbc_switch_day " << P.bc_switch_day << "\n";
	o << "implant_E " << P.implant_E << "\nimplant_nu " << P.implant_nu << "\n";
	if (P.iterations < 1 || P.iterations > NUMBER_ITERATIONS) {
		cerr << "ERROR: iterations must be 1.." << NUMBER_ITERATIONS << " (build with -DNUMBER_ITERATIONS_OVERRIDE=N for more)" << endl;
		return false;
	}
	cout << "  Parameters: " << n << " set in " << file << " (all values in params_used.txt)" << endl;
	return true;
}
