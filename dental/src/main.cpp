// Modified by Melih Marangoz in 2026 for the CalculiX port (changes marked [CCX]; see NOTICE).
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
	unsigned int seed = (argc > 1) ? (unsigned)strtoul(argv[1], nullptr, 10) : (unsigned)time(NULL); // [CCX]
	srand(seed); // seed for random numbers
	seed_rng(seed); // [CCX]
	cout<<"Random number seed: "<<seed<<endl;
    
    int iteration;
    int i,j,k;
	
    /****************************************************************************************
    	Set lattice points (12:scaffold, 13: plate, 11:bone, 0:free, age 666)
    *****************************************************************************************/
	int a, b, c, d, h;
	h = int(5/CELL_DIAMETER)+1; // bone extremity is 5 mm high
    a = int(3.75/CELL_DIAMETER)+1; // x axis bone marrow
	b = int(4.4/CELL_DIAMETER)+1; // y axis bone marrow
	c = int(7.5/CELL_DIAMETER)+1; // x axis bone
	d = int(8.5/CELL_DIAMETER)+1; // y axis bone
		
	cout<<"Initialize lattice as scaffold, bone or empty"<<endl;
	for (i=0;i<LATTICE_X;i++) {
        for (j=0;j<LATTICE_Y;j++) {
            for (k=0;k<LATTICE_Z;k++) {
                age_cells[i][j][k]=666;
                lattice[i][j][k]=0; // first empty everywhere, then given regions will be filled appropriately

				// fixation plate
            	if (i-(LATTICE_X-1)/2<68 && -i+(LATTICE_X-1)/2<68 && j>(LATTICE_Y-1)/2+d && j<(LATTICE_Y-1)/2+d+5.6/CELL_DIAMETER) { // plate is 5.6 mm thick
                	lattice[i][j][k]=13; // relevant positions will be freed for tissue later on
				}
				
				if((k<=h || k>=LATTICE_Z-h)) {
					// Intact bone in upper and lower cylinders
					if (pow(i-(LATTICE_X-1)/2,2)/pow(c,2)+pow(j-(LATTICE_Y-1)/2,2)/pow(d,2)<=1 &&  
						pow(i-(LATTICE_X-1)/2,2)/pow(a,2)+pow(j-(LATTICE_Y-1)/2,2)/pow(b,2)>1) {
						lattice[i][j][k]=11;
					}
            	}
        	}
    	}
    }
    
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
    Initialize_lattice(lattice,age_cells);                    
    
    /**************************************************************************************
                                     Write_lattice_file_for_gnuplot
    *****************************************************************************************/
    cout<<"Write results file"<<endl;
    iteration=999;
    Write_raw_lattice_file(lattice, iteration); // full 3D model as binary file    

    // [CCX] kafes-ag ortusme kontrolu: kemik ekseni kafes merkezinde olmali
    {
        long n = 0; int imin=LATTICE_X, imax=-1, jmin=LATTICE_Y, jmax=-1, kmin=LATTICE_Z, kmax=-1;
        for (i=0;i<LATTICE_X;i++) for (j=0;j<LATTICE_Y;j++) for (k=0;k<LATTICE_Z;k++)
            if (lattice_point_element[i][j][k]!=0) { n++;
                imin=min(imin,i); imax=max(imax,i); jmin=min(jmin,j); jmax=max(jmax,j); kmin=min(kmin,k); kmax=max(kmax,k); }
        cout << "  Kallus kafes noktasi: " << n << " (" << n*1e-3 << " mm3)  i[" << imin << "," << imax << "] j[" << jmin << "," << jmax
             << "] k[" << kmin << "," << kmax << "]  Global_min = (" << Global_minimum[0] << ", " << Global_minimum[1] << ", " << Global_minimum[2] << ")" << endl;        // gorsellestirme icin 3 kesitin eleman haritasi (int32): x-merkez (y,z), y-merkez (x,z), z-merkez (x,y)
        std::ofstream kf("kesit_eleman.bin", std::ios::binary);
        const int ci=(LATTICE_X-1)/2, cj=(LATTICE_Y-1)/2, ck=(LATTICE_Z-1)/2;
        for (j=0;j<LATTICE_Y;j++) kf.write((const char*)&lattice_point_element[ci][j][0], sizeof(int)*LATTICE_Z);
        for (i=0;i<LATTICE_X;i++) kf.write((const char*)&lattice_point_element[i][cj][0], sizeof(int)*LATTICE_Z);
        for (i=0;i<LATTICE_X;i++) for (j=0;j<LATTICE_Y;j++) kf.write((const char*)&lattice_point_element[i][j][ck], sizeof(int));
    }

    // [CCX] baslangic FE cozumu: tum kallus granulasyon dokusu (E = 0.2 MPa, nu = 0.167)
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
        cout<<"Read stimulus"<<endl;
        if (!Read_stimulus(stimulus,elements)) { // [CCX]
            cerr << "Iterasyon " << iteration << ": stimulus okunamadi, simulasyon durduruldu." << endl;
            return 2;
        }
        
        /**************************************************************************************
                                               Differentiation
        *****************************************************************************************/   
        if (iteration>5)
        {
           cout<<"Cell differentiation"<<endl;
           Cell_differentiation(lattice,age_cells,stimulus,element_local_min,element_local_max,lattice_point_element,iteration);           
        }  
        
        /**************************************************************************************
                                               Proliferation
        *****************************************************************************************/   
        cout<<"Cell proliferation"<<endl;
        Cell_proliferation(lattice,age_cells,element_local_min,element_local_max,lattice_point_element,stimulus,iteration); 
            
        /**************************************************************************************
                                               Migration
        *****************************************************************************************/   
        cout<<"Cell migration"<<endl;
        Cell_migration(lattice,age_cells,lattice_point_element,iteration);
        
        /**************************************************************************************
                                     Write lattice content into files
        *****************************************************************************************/
        cout<<"Write results files"<<endl;
//        Write_lattice_file_gnuplot(lattice,iteration); // txt files with one slice
        if (iteration % RAW_WRITE_INTERVAL == 0 || iteration == NUMBER_ITERATIONS-1) // [CCX] disk
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
        if (iteration>5 && iteration<NUMBER_ITERATIONS-1 && iteration%3==0) // no need to run ABAQUS model in the last iteration; run every 3 iterations
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
