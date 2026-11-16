// Modified by Melih Marangoz in 2026 for the CalculiX port and the dental socket model
// (changes marked [CCX] and [DENTAL]; see NOTICE and dental/README.md).
#include <cstdlib>
#include <time.h>
#include <stdio.h>
#include <stdlib.h>
#include <iostream>
#include <cmath>
#include <string>
#include <filesystem>
#include <algorithm>
#include <fstream>
#include "header.h"

// [CCX] CalculiX uyarlamasi -- degisiklikler "[CCX]" ile isaretli:
//  - tohum komut satirindan: ./mechanobio <tohum>  (tekrarlanabilir; mt19937, nrand.cpp)
//  - baslangic FE cozumu (tum kallus granulasyon dokusu) program icinde yapiliyor (orijinalde elle)
//  - "./run.bat" (Abaqus) yerine FE_CMD (varsayilan ./run.sh -> ccx); donus degeri kontrol ediliyor
//  - Read_stimulus / Update_model basarisizsa program acik mesajla duruyor (sonsuz dongu / sahte stimulus yok)
//  - lattice_N.raw her RAW_WRITE_INTERVAL gunde bir + son gun (disk); gunluk istatistik.csv
#ifndef FE_CMD
#define FE_CMD "./run.sh"
#endif

// For a new model: adapt LATTICE_X, LATTICE_Y, LATTICE_Z, NUMBER_ELEMS, NUMBER_NODES, NUMBER_ITERATIONS, NODES_PER_ELEM (header.h); min_elem_callus (update_model.cpp)
//       Initial cell seeding (Initialize_lattice.cpp and main.cpp)
//       Update_model.cpp : last lines with loads & BCs + file names + material properties (different species)
// 		 Calculate_lattice.cpp : adapt Global_min and Global_max if necessary (if boundaries different between FE model and 3D lattice)
// 		 Cell_proliferation.cpp & cell_differentiation.cpp: possibly adaptations to remove some elements from the proliferation process / for different mechanoregulation levels
//		 Cell_migration.cpp & Jump_migration.cpp: adapt the zones to be included or not in the migration process; number of jumps
//		 Write_raw_lattice_file: ROI written in raw file (if not full lattice)
//		 Read_stimulus: proper file
//		 Jump_migration: adapt values for cells to be removed

using namespace std;

unsigned int g_run_seed = 0; // [DENTAL]
int g_iter = 0;              // [DENTAL]

int main(int argc, char** argv)
{
    float (*nodes)[3] = new float[NUMBER_NODES][3];
	int (*elements)[NODES_PER_ELEM] = new int[NUMBER_ELEMS][NODES_PER_ELEM]; 
	char* stimulus = new char[NUMBER_ELEMS];
	
	int (*element_local_min)[3] = new int[NUMBER_ELEMS][3];
	int (*element_local_max)[3] = new int[NUMBER_ELEMS][3];
	float* Global_minimum = new float[3];
	float* Global_maximum = new float[3];
	
	char (*lattice)[LATTICE_Y][LATTICE_Z] = new char[LATTICE_X][LATTICE_Y][LATTICE_Z];
	short (*age_cells)[LATTICE_Y][LATTICE_Z] = new short[LATTICE_X][LATTICE_Y][LATTICE_Z];
	int (*lattice_point_element)[LATTICE_Y][LATTICE_Z] = new int[LATTICE_X][LATTICE_Y][LATTICE_Z]; //element number for each lattice point

	float (*Young_modulus)[NUMBER_ITERATIONS] = new float[NUMBER_ELEMS][NUMBER_ITERATIONS];
	float (*Poisson_ratio)[NUMBER_ITERATIONS] = new float[NUMBER_ELEMS][NUMBER_ITERATIONS];
	
	// Initialization for first iterations (granulation tissue properties)
	for(int elem=0; elem!=NUMBER_ELEMS; elem++) {
		for(int i=0;i!=6;i++) {
			Young_modulus[elem][i] = 0.2; 
			Poisson_ratio[elem][i]=0.167;
		}
	}
	
	// [CCX] onceki bir kosunun ciktisinin uzerine yazmayi onle
	if (std::filesystem::exists("lattice_999.raw") && getenv("MECHANOBIO_UZERINE_YAZ") == nullptr) {
		cerr << "DUR: bu klasorde onceki kosu ciktisi var (lattice_999.raw). Yeni klasor kullanin "
		     << "ya da MECHANOBIO_UZERINE_YAZ=1 verin." << endl;
		return 3;
	}
	if (!Load_params("params.txt")) return 5; // [DENTAL] runtime parameters (params.txt is optional)
	unsigned int seed = (argc > 1) ? (unsigned)strtoul(argv[1], nullptr, 10) : (unsigned)time(NULL); // [CCX]
	srand(seed); // seed for random numbers
	seed_rng(seed); // [CCX]
	g_run_seed = seed; // [DENTAL]
	cout<<"Random number seed: "<<seed<<endl;
    
    int iteration;
    int i,j,k;
	
    /****************************************************************************************
    	[DENTAL] The long-bone setup (plate 13, bone ends 11) is gone: the socket lattice comes from
    	lattice_init.raw (Initialize_lattice) after the socket elements have been mapped.
    *****************************************************************************************/
	for (i=0;i<LATTICE_X;i++) for (j=0;j<LATTICE_Y;j++) for (k=0;k<LATTICE_Z;k++) { lattice[i][j][k]=LATTICE_BONE; age_cells[i][j][k]=666; }
    
    /**************************************************************************************
                                              Read node file
    *****************************************************************************************/
    cout<<"Read nodes"<<endl;
    Read_node_file(nodes);
 
    /**************************************************************************************
                                              Read element file
    *****************************************************************************************/
    cout<<"Read elements"<<endl;
    Read_element_file(elements);
 
    /**************************************************************************************
                                     Calculate dimensions of the lattice
    *****************************************************************************************/
    cout<<"Calculate dimensions lattice"<<endl;
    Calculate_lattice(elements,nodes,Global_minimum,Global_maximum);
    
    /**************************************************************************************
                               Calculate extreme values of x,y and z of the element
    *****************************************************************************************/
    cout<<"Calculate extreme dimensions element (cube that contains it)"<<endl;
    Extremes_element(elements,nodes,element_local_min,element_local_max,Global_minimum,Global_maximum);    

    /**************************************************************************************
                               Calculate lattice points inside each element
    *****************************************************************************************/
    cout<<"Calculate lattice points inside each tissue element and make them free"<<endl;
    Lattice_point_in_element(lattice,lattice_point_element,element_local_min,element_local_max,Global_minimum,Global_maximum,nodes,elements);   
    
    /**************************************************************************************
                                        Initialize lattice
    *****************************************************************************************/
    cout<<"Initialize lattice"<<endl;
    if (!Initialize_lattice(lattice,age_cells,lattice_point_element)) return 2; // [DENTAL]
    
    /**************************************************************************************
                                     Write_lattice_file_for_gnuplot
    *****************************************************************************************/
    cout<<"Write results file"<<endl;
    iteration=999;
    Write_raw_lattice_file(lattice, iteration); // full 3D model as binary file    

    // [DENTAL] element number of every lattice point (int32, [LATTICE_X][LATTICE_Y][LATTICE_Z], 0 = not socket)
    {
        std::ofstream ef("lattice_element.bin", std::ios::binary);
        ef.write(reinterpret_cast<const char*>(&lattice_point_element[0][0][0]), sizeof(int)*(size_t)LATTICE_X*LATTICE_Y*LATTICE_Z);
        cout << "  Lattice " << LATTICE_X << " x " << LATTICE_Y << " x " << LATTICE_Z << ", origin (" << Global_minimum[0] << ", "
             << Global_minimum[1] << ", " << Global_minimum[2] << "), far-field strain " << P.farfield_strain << endl;
    }

    // [CCX] initial FE solution: the whole socket is granulation tissue (E = 0.2 MPa, nu = 0.167)
    {
        float* E0 = new float[NUMBER_ELEMS]; float* nu0 = new float[NUMBER_ELEMS];
        for (int e=0; e<NUMBER_ELEMS; e++) { E0[e]=0.2f; nu0[e]=0.167f; }
        const bool ok = Write_ccx_input(E0, nu0);
        delete[] E0; delete[] nu0;
        if (!ok) return 2;
        cout << "Initial FE solution (CalculiX)" << endl;
        if (system(FE_CMD) != 0) { cerr << "HATA: ilk FE cozumu basarisiz (" << FE_CMD << ")." << endl; return 4; }
    }
    
//    system("PAUSE");
    
    for (iteration=0;iteration<NUMBER_ITERATIONS;iteration++)
    {
    
        /****************************************************************************************
                                               Read stimulus
        *****************************************************************************************/   
        g_iter = iteration; // [DENTAL]
        Resorb_granules(lattice, age_cells, iteration); // [DENTAL] beta-TCP resorption (no-op without granules)
        // [DENTAL] grafted socket: the cell biology runs P.tcp_delay days late. Its clock (differentiation from day 6,
        // the high-activity period, remodelling, clot entry) is iteration - tcp_delay; before that the cells wait
        // (with tcp_delay_all 0 only differentiation waits). Resorption, ageing and mechanics keep the real clock.
        const int bio = (P.granule_fraction > 0) ? iteration - P.tcp_delay : iteration;
        const bool cells_act = bio >= 0 || !P.tcp_delay_all;
        cout<<"Read stimulus"<<endl;
        if (!Read_stimulus(stimulus,elements)) { // [CCX]
            cerr << "Iterasyon " << iteration << ": stimulus okunamadi, simulasyon durduruldu." << endl;
            return 2;
        }
        if (P.raw_daily) Write_mechanics(iteration); // [DENTAL]
        
        /**************************************************************************************
                                               Differentiation
        *****************************************************************************************/   
        if (bio>5) // [DENTAL] biological clock (= iteration without granules)
        {
           cout<<"Cell differentiation"<<endl;
           Cell_differentiation(lattice,age_cells,stimulus,element_local_min,element_local_max,lattice_point_element,bio);           
        }  
        
        /**************************************************************************************
                                               Proliferation
        *****************************************************************************************/   
        if (cells_act) { // [DENTAL]
        cout<<"Cell proliferation"<<endl;
        Cell_proliferation(lattice,age_cells,element_local_min,element_local_max,lattice_point_element,stimulus,std::max(bio, 0)); 
        }
            
        /**************************************************************************************
                                               Migration
        *****************************************************************************************/   
        if (cells_act) { // [DENTAL]
        cout<<"Cell migration"<<endl;
        Cell_migration(lattice,age_cells,lattice_point_element,std::max(bio, 0));
        }
        
        /**************************************************************************************
                                     Write lattice content into files
        *****************************************************************************************/
        cout<<"Write results files"<<endl;
//        Write_lattice_file_gnuplot(lattice,iteration); // txt files with one slice
        if (P.raw_daily ? (iteration % RAW_WRITE_INTERVAL == 0 || iteration == NUMBER_ITERATIONS-1) // [CCX] disk
                        : (iteration == 13 || iteration == 27 || iteration == 55)) // [DENTAL] days 14, 28, 56 only
            Write_raw_lattice_file(lattice, iteration); // full 3D model as binary file
        Write_statistics(lattice, lattice_point_element, stimulus, iteration); // [CCX]
        
        /**************************************************************************************
                                              Update model
        *****************************************************************************************/  
        if (iteration>5 && iteration<NUMBER_ITERATIONS-1) // no need to update model in the last iteration
        {
           cout<<"Update model"<<endl;
           if (!Update_model(lattice, Young_modulus, Poisson_ratio, iteration, element_local_min, element_local_max, lattice_point_element)) { // [CCX]
               cerr << "Update_model basarisiz, simulasyon durduruldu." << endl;
               return 3;
           }
        }
        /**************************************************************************************
                                           Increase cell age
        *****************************************************************************************/               
        
		if (iteration<NUMBER_ITERATIONS-1) // not for last iteration
		{
			cout<<"Increase_age"<<endl;
        	Cell_age(age_cells); 
    	}
             
        /**************************************************************************************
                                              Run abaqus
        *****************************************************************************************/  
        const bool fe_needed = !(P.force_stimulus > 0 && P.skip_fe_when_forced); // [DENTAL] forced stimulus: mechanics unused
        if (fe_needed && iteration>5 && iteration<NUMBER_ITERATIONS-1 && iteration%3==0) // no need to run ABAQUS model in the last iteration; run every 3 iterations
        {
            cout<<"run FE (CalculiX)"<<endl; // [CCX] orijinal: system("./run.bat") (Abaqus), donus kontrolsuz
            if (system(FE_CMD) != 0) {
                cerr << "HATA: FE komutu (" << FE_CMD << ") basarisiz, iterasyon " << iteration << endl;
                return 4;
            }
        }
        
        cout<<"Iteration no."<<iteration<<" completed!"<<endl;
        
    }
    
	delete[] nodes;
	delete[] elements;
	delete[] stimulus;

	delete[] element_local_min;
	delete[] element_local_max;
	delete[] Global_minimum;
	delete[] Global_maximum;
	
	delete[] lattice;
	delete[] age_cells;
	delete[] lattice_point_element;

	delete[] Young_modulus;
	delete[] Poisson_ratio;
	
    //system("PAUSE");
    return 0;
}
