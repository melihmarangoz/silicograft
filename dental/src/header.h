// Modified by Melih Marangoz in 2026 for the CalculiX port and the dental socket model
// (changes marked [CCX] and [DENTAL]; see NOTICE and dental/README.md).
#pragma once
#include <random>
#include "model_info.h" // [DENTAL] NUMBER_NODES, NUMBER_ELEMS, LATTICE_X/Y/Z, LATTICE_ORIGIN_*, BLOCK_LENGTH_X:
                        //          written by dental/geometry/socket_geometry.py

// [DENTAL] LATTICE_X, LATTICE_Y, LATTICE_Z now come from model_info.h (long bone: 361 x 361 x 401)
#ifdef NUMBER_ITERATIONS_OVERRIDE
constexpr int NUMBER_ITERATIONS = NUMBER_ITERATIONS_OVERRIDE; // [CCX] short tests
#else
constexpr int NUMBER_ITERATIONS = 56; // [DENTAL] 8 weeks (Hong et al. 2014); day d = state after iteration d-1
#endif
#ifndef RAW_WRITE_INTERVAL
#define RAW_WRITE_INTERVAL 1 // [DENTAL] the socket lattice is small (~170 kB): write every day
#endif
constexpr int IPS_PER_ELEM = 4;          // [CCX] C3D10 -> 4 integration points
constexpr int FIRST_CALLUS_ELEMENT = 1;  // [CCX] first socket element label
constexpr int NODES_PER_ELEM = 10; // number of nodes per element in Abaqus model (for callus part)
constexpr float CELL_DIAMETER = 0.1; // (in mm)
constexpr int ACTIVITY_MAX = 15; // latency period of 15 days [DENTAL] default of P.activity_days

// [DENTAL] lattice codes besides the cells (0 free, 1 MSC, 2 osteoblast, 4 chondrocyte, 5 fibroblast, 6-10 temporary)
constexpr char LATTICE_BONE = 11;  // native alveolar bone (socket wall)
constexpr char LATTICE_COVER = 14; // soft-tissue cover over the socket opening (closed flap)
constexpr char LATTICE_GRANULE = 12; // [DENTAL] beta-TCP granule (upstream: scaffold)

// [DENTAL] day-0 cell source: MSCs in a lining of LINING_VOXELS lattice points along the bony socket wall
// (PDL remnants and wall marrow openings), SEED_FRACTION of those points, chosen with a fixed pattern seed so
// every run starts from the same seeding. The long-bone model seeded 30 % of marrow and periosteum points.
#ifndef SEED_FRACTION
#define SEED_FRACTION 0.30
#endif
#ifndef LINING_VOXELS
#define LINING_VOXELS 2
#endif
#ifndef SEED_PATTERN
#define SEED_PATTERN 2014u
#endif

// [DENTAL] far-field mesio-distal strain applied to the bone block (compression negative in the input deck).
// Default 300 microstrain; see dental/README.md for the choice.
#ifndef FARFIELD_STRAIN
#define FARFIELD_STRAIN 3.0e-4
#endif

// [DENTAL] Runtime parameters of the socket model (Dental_params.cpp). Defaults reproduce milestone 1
// (the compile-time macros above); a run folder may override any of them in params.txt ("name value" lines).
// The values used are written to params_used.txt.
struct Params {
	double farfield_strain = FARFIELD_STRAIN; // far-field mesio-distal strain on the bone block
	int force_stimulus = 0;        // >0: every element gets this stimulus (2 = bone): biology-only setting
	int skip_fe_when_forced = 1;   // with force_stimulus, skip the FE solves after the initial one
	int stimulus_mode = 0;         // 0 element-average HP (upstream); 1 soft-tissue phase HP (iso-strain)
	int lower_window = 1;          // 1: upstream resorption window (|HP| < 0.0016 MPa and |e_min| < 0.0004)
	int activity_days = ACTIVITY_MAX; // iterations with high cell activity (upstream 15)
	double late_factor = 0.2;      // rates after activity_days = early rates x late_factor (upstream 1/5)
	double seed_fraction = SEED_FRACTION;
	int lining_voxels = LINING_VOXELS;
	int cover_source = 0;          // 1: the soft-tissue cover over the opening is seeded and guides like the walls
	int matrix_day = -1;           // >=0: from this iteration MSCs migrate into free socket points without a
	                               // guiding neighbour (the clot has become provisional matrix); -1 = never (upstream)
	double remodel_rate = 0.0;     // daily fraction of osteoblasts removed (woven-bone resorption -> marrow space)
	int remodel_day = 14;          // iteration from which remodelling acts
	int raw_daily = 1;             // 1: lattice every day; 0: only the initial lattice and days 14, 28, 56
	// beta-TCP granules (Granules.cpp); granule_fraction 0 = empty socket
	double granule_fraction = 0.0; // target share of socket points occupied by granules at day 0 (envelope)
	double granule_dmin = 0.5, granule_dmax = 1.0; // granule diameters (mm), uniform
	double granule_overlap = 0.1;  // allowed interpenetration (fraction of the radius sum) in the random packing
	int granule_pattern = -1;      // RNG seed of the packing; -1: run seed + 1000 (a new packing per replicate)
	double tcp_k = 0.031;          // first-order resorption rate of granule volume (/day); radius ~ exp(-k t / 3)
	int tcp_lag = 0;               // iteration from which granules resorb
	double tcp_E = 3500.0, tcp_nu = 0.3; // granule modulus (MPa) in the rule of mixtures (35 % porous beta-TCP)
	int tcp_guides = 1;            // 1: granules guide migration and differentiation (upstream scaffold code 12)
	int tcp_guide_day = 0;         // iteration from which they guide
	double tcp_late_mult = 1.0;    // with granules, late_factor x this (upstream "TCP stimulation" = 2.5: /2 instead of /5)
	double tcp_diff_mult = 1.0;    // with granules, differentiation rate x this while iter < tcp_inhibit_days
	int tcp_inhibit_days = 0;
	int tcp_delay = 0;             // with granules, the healing biology runs this many days late (Hong 2014: grafts
	                               // "delay rather than arrest" bone formation); see main.cpp
	int tcp_delay_all = 1;         // 1: proliferation, migration and differentiation all wait; 0: only differentiation
};
extern Params P;
bool Load_params(const char* file);
extern unsigned int g_run_seed; // [DENTAL] run seed (main.cpp), for the granule packing
extern int g_iter;              // [DENTAL] current iteration (main.cpp), for day-dependent rules
// [DENTAL] granules: placed on free socket points before the MSC seeding; resorbed day by day
long Place_granules(char lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z]);
long Resorb_granules(char lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], short age[LATTICE_X][LATTICE_Y][LATTICE_Z], int iter);

// [CCX] shared, seedable random engine (nrand.cpp)
std::mt19937& rng();
void seed_rng(unsigned int seed);
int nrand(int n);
int sg_count(int n, double rate); // [DENTAL] number of cells out of n that act at a given rate (Dental_utils.cpp)
bool Neighbour_guides(char v);    // [DENTAL] does a lattice value count as a neighbour for migration/differentiation?

void Read_node_file(float nodes_position[NUMBER_NODES][3]);
void Read_element_file(int nodes_element[NUMBER_ELEMS][NODES_PER_ELEM]);
void Calculate_lattice(int lattice_element[NUMBER_ELEMS][NODES_PER_ELEM], float lattice_node_position[NUMBER_NODES][3], float Global_min[3], float Global_max[3]);
void Extremes_element(int extremes_element_nodes[NUMBER_ELEMS][NODES_PER_ELEM],float extremes_node_positions[NUMBER_NODES][3],int extreme_min[NUMBER_ELEMS][3],
	int extreme_max[NUMBER_ELEMS][3], float Global_min_extreme[3],float Global_max_extreme[3]);
void Lattice_point_in_element (char lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], int lattice_points_element[LATTICE_X][LATTICE_Y][LATTICE_Z], int element_min[NUMBER_ELEMS][3],
	int element_max[NUMBER_ELEMS][3],float Global_min[3], float Global_max[3],float node_pos[NUMBER_NODES][3],int elem_nodes[NUMBER_ELEMS][NODES_PER_ELEM]);
float Plane_intersection(float face[3][3],float x,float y,float z);
// [DENTAL] reads lattice_init.raw and reconciles it with the lattice points inside socket elements
bool Initialize_lattice(char initial_lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], short initial_age[LATTICE_X][LATTICE_Y][LATTICE_Z],
	int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z]);
bool Read_stimulus(char Stimulus_read[NUMBER_ELEMS],int elements_read[NUMBER_ELEMS][NODES_PER_ELEM]);
void Write_mechanics(int iter); // [DENTAL] per-element HP and minimum principal strain of the last FE solution

void Cell_differentiation(char cells_dif[LATTICE_X][LATTICE_Y][LATTICE_Z],short age_dif[LATTICE_X][LATTICE_Y][LATTICE_Z],char stimulus_dif[NUMBER_ELEMS],
	int element_local_min[NUMBER_ELEMS][3],int element_local_max[NUMBER_ELEMS][3],int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z], int iter);
void Cell_proliferation(char cells_prol[LATTICE_X][LATTICE_Y][LATTICE_Z], short age_prol[LATTICE_X][LATTICE_Y][LATTICE_Z],int element_local_min [NUMBER_ELEMS][3],
	int element_local_max[NUMBER_ELEMS][3],int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z], char stimulus_prol[NUMBER_ELEMS], int iter);
void Cell_mitosis(char cells_mitosis[LATTICE_X][LATTICE_Y][LATTICE_Z], int i1, int j1, int k1, int cellnumber,short age_mitosis[LATTICE_X][LATTICE_Y][LATTICE_Z]);
void Cell_migration(char cells_migration[LATTICE_X][LATTICE_Y][LATTICE_Z], short age_migration[LATTICE_X][LATTICE_Y][LATTICE_Z],
	int lattice_points_element[LATTICE_X][LATTICE_Y][LATTICE_Z], int iter);
int Jump_migration(char cell_jump[LATTICE_X][LATTICE_Y][LATTICE_Z],int i_jump, int j_jump, int k_jump,short age_jump[LATTICE_X][LATTICE_Y][LATTICE_Z],
	int cell_number, int lattice_points_element[LATTICE_X][LATTICE_Y][LATTICE_Z], int iter);
bool Neighbour_presence(char cell_neighbour[LATTICE_X][LATTICE_Y][LATTICE_Z], int i_source, int j_source, int k_source, int i_dest, int j_dest, int k_dest);

void Write_raw_lattice_file(char const raw_cell[LATTICE_X][LATTICE_Y][LATTICE_Z], int td);

bool Update_model(char lattice[LATTICE_X][LATTICE_Y][LATTICE_Z],float Young_modulus_prop[NUMBER_ELEMS][NUMBER_ITERATIONS], float Poison_ratio_prop[NUMBER_ELEMS][NUMBER_ITERATIONS],
	int t_prop,int element_local_min[NUMBER_ELEMS][3], int element_local_max[NUMBER_ELEMS][3],int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z]);
bool Write_ccx_input(const float* Young_mod_elem, const float* Poison_rat_elem); // [CCX]
void Cell_age(short age[LATTICE_X][LATTICE_Y][LATTICE_Z]);

void Write_statistics(char const lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z],
	char const stimulus[NUMBER_ELEMS], int iter); // [CCX] daily cell counts (statistics.csv) [DENTAL] + zones.csv
extern float E_soft_phase[NUMBER_ELEMS]; // [DENTAL] modulus of the non-bone part of each element (Update_model.cpp)

struct Point {
	int x, y, z;
};
