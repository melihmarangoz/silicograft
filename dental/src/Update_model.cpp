// Modified by Melih Marangoz in 2026 for the CalculiX port and the dental socket model
// (changes marked [CCX] and [DENTAL]; see NOTICE).
/************************************************************

    Algorithm to update material properties
         in each of the elements
 
************************************************************/

#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>
#include <fstream>
#include <map>
#include <vector>
#include <filesystem>
#include "header.h"

using namespace std;

float E_soft_phase[NUMBER_ELEMS]; // [DENTAL] set below; granulation tissue (0.2 MPa) until the first update
static bool E_soft_init = [] { for (int e = 0; e < NUMBER_ELEMS; e++) E_soft_phase[e] = 0.2f; return true; }();


bool Update_model(char lattice[LATTICE_X][LATTICE_Y][LATTICE_Z], float Young_modulus_prop[NUMBER_ELEMS][NUMBER_ITERATIONS], float Poison_ratio_prop[NUMBER_ELEMS][NUMBER_ITERATIONS], 
	int t_prop,int element_local_min[NUMBER_ELEMS][3], int element_local_max[NUMBER_ELEMS][3],int lattice_point_element[LATTICE_X][LATTICE_Y][LATTICE_Z])
{    
    float* Young_mod_elem = new float[NUMBER_ELEMS];
	float* Poison_rat_elem = new float[NUMBER_ELEMS];
     
	int elem;
    int i,j,k;
    int imin,jmin,kmin;
    int imax,jmax,kmax;
    float total;
    float number_MSC,number_chondrocytes,number_fibroblasts,number_mature_osteoblasts;
    int count;
    int count2;
    int first_element = 1; // first element in callus
     
    for(elem=0;elem<NUMBER_ELEMS;elem++)
    {
        Young_mod_elem[elem]=Poison_rat_elem[elem]=0.0;
    }
     
    for (elem=0;elem<NUMBER_ELEMS;elem++)
    {
            
        imin=element_local_min[elem][0];
        jmin=element_local_min[elem][1];
        kmin=element_local_min[elem][2];
        
        imax=element_local_max[elem][0];
        jmax=element_local_max[elem][1];
        kmax=element_local_max[elem][2];
         
        total=0.0;
        
        for (i=imin;i<imax;i++)
        {
            for (j=jmin;j<jmax;j++)
            {
                for (k=kmin;k<kmax;k++)
                {
                   if (lattice_point_element[i][j][k]==elem+1)
                   {
                        total=total+1.0;
                   }
                }
            }
        }
                        
        if (total==0.0)
        {
            Young_mod_elem[elem]=0.2;
            Poison_rat_elem[elem]=0.167;
        }
        else
        {
         
            number_MSC=number_chondrocytes=number_fibroblasts=number_mature_osteoblasts=0;
    
            for (i=imin;i<imax;i++)
            {
                for (j=jmin;j<jmax;j++)
                {
                    for (k=kmin;k<kmax;k++)
                    {
                        if (lattice_point_element[i][j][k]==elem+1)
                        {
                            switch (lattice[i][j][k])
                            {
                                case 1:
                                    number_MSC=number_MSC+1.0;
                                    break;
                                case 2:
                                    number_mature_osteoblasts=number_mature_osteoblasts+1.0;
                                    break;
                                case 4:
                                    number_chondrocytes=number_chondrocytes+1.0;  
                                    break;
                                case 5:
                                    number_fibroblasts=number_fibroblasts+1.0; 
                                    break;    
                            }   
                        }
                    }
                }
            } //end for
            
         
        // [DENTAL] modulus of the non-bone (soft) part of the element, for the soft-phase stimulus (Read_stimulus)
        {
            const float soft = total - number_mature_osteoblasts;
            E_soft_phase[elem] = soft > 0 ? (number_chondrocytes*10.0f + number_fibroblasts*2.0f
                + (soft - number_chondrocytes - number_fibroblasts)*0.2f) / soft : 0.2f;
        }
        Young_modulus_prop[elem][t_prop]=(number_chondrocytes*10.0/total)+(number_fibroblasts*2.0/total)
			+(number_mature_osteoblasts*17000.0/total)+((total-number_fibroblasts-number_mature_osteoblasts-number_chondrocytes)*0.2/total); 
        Poison_ratio_prop[elem][t_prop]=(number_chondrocytes*0.167/total)+(number_fibroblasts*0.167/total)
			+(number_mature_osteoblasts*0.3/total)+((total-number_fibroblasts-number_chondrocytes-number_mature_osteoblasts)*0.167/total);

        i=t_prop;         
        count=0;
        while (i>=0 && count<10)
        {
            Young_mod_elem[elem]=Young_mod_elem[elem]+Young_modulus_prop[elem][i];
            Poison_rat_elem[elem]=Poison_rat_elem[elem]+Poison_ratio_prop[elem][i];
            count=count+1;
            i=i-1;
        }
         
        //added to consider change of material properties****************
        if (count<=9)
        {
            count2=10-count;
            Young_mod_elem[elem]=Young_mod_elem[elem]+0.2*count2;
            Poison_rat_elem[elem]=Poison_rat_elem[elem]+0.167*count2;
        }
        //*******************************************************************
         
        Young_mod_elem[elem]=Young_mod_elem[elem]/10;
        Poison_rat_elem[elem]=Poison_rat_elem[elem]/10;

        } // end else total==0.0  
         
    }// end for element
     
	// [CCX] Orijinal: "rm without_scaffold.inp; cp Model.txt without_scaffold.inp" + Abaqus malzeme/BC/adim.
	//        Artik CalculiX girdisi Write_ccx_input() ile yaziliyor (ayni yukler ve sinir kosullari).
	const bool ok = Write_ccx_input(Young_mod_elem, Poison_rat_elem);

	delete[] Young_mod_elem;
	delete[] Poison_rat_elem;
	return ok;
}

// [CCX] CalculiX input deck. [DENTAL] model_template.inp (nodes, elements, native bone materials, node sets,
// fixed supports) + socket materials + the load step: the distal face of the bone block is displaced towards
// the mesial face (fixed in x), which imposes a nominal mesio-distal compressive strain P.farfield_strain on the
// block. Elements with the same (E, nu) text share one material, as in the long-bone port.
bool Write_ccx_input(const float* Young_mod_elem, const float* Poison_rat_elem)
{
	namespace fs = std::filesystem;
	const int first_element = FIRST_CALLUS_ELEMENT;
	if (!fs::exists("model_template.inp")) {
		cerr << "ERROR: model_template.inp missing (run dental/geometry/socket_geometry.py)." << endl;
		return false;
	}
	map<string, vector<int>> groups;
	for (int elem = 0; elem < NUMBER_ELEMS; elem++) {
		ostringstream key;
		key << Young_mod_elem[elem] << "," << Poison_rat_elem[elem];
		groups[key.str()].push_back(elem + first_element);
	}
	const string tmp = "socket.inp.tmp";
	fs::copy_file("model_template.inp", tmp, fs::copy_options::overwrite_existing);
	ofstream myfile(tmp, ios::app);
	int g = 0;
	for (const auto& kv : groups) {
		g++;
		myfile << "*MATERIAL, NAME=material_" << g << "\n*ELASTIC\n" << kv.first << "\n";
		myfile << "*ELSET, ELSET=SOCKET_" << g << "\n";
		const vector<int>& v = kv.second;
		for (size_t n = 0; n < v.size(); n++)
			myfile << v[n] << ((n + 1) % 16 && n + 1 < v.size() ? ", " : "\n");
		myfile << "*SOLID SECTION, ELSET=SOCKET_" << g << ", MATERIAL=material_" << g << "\n";
	}
	const double ux = -P.farfield_strain * BLOCK_LENGTH_X; // [DENTAL] runtime parameter
	myfile << "**\n** STEP: far-field mesio-distal strain " << P.farfield_strain << " (distal face ux = " << ux << " mm)\n";
	myfile << "*STEP\n*STATIC\n1., 1., 1e-05, 1.\n";
	myfile << "*BOUNDARY\nDISTAL, 1, 1, " << ux << "\n";
	myfile << "*EL PRINT, ELSET=SOCKET\nS, E\n";
	myfile << "*END STEP\n";
	myfile.close();
	if (!myfile) { cerr << "ERROR: could not write " << tmp << endl; return false; }
	fs::rename(tmp, "socket.inp");
	return true;
}
