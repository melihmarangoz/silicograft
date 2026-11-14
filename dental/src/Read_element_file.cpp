// Modified by Melih Marangoz in 2026 for the CalculiX port (changes marked [CCX]; see NOTICE).
// [CCX] 05_Mechanabio/duzeltilmis_kod surumu: Read_element_file.cpp
// Orijinal sorunlar: dosya/format kontrolü yok; düğüm referansı 1..NUMBER_NODES dışında olabiliyor.
// ÖNEMLİ: export_mesh.py 'e.connectivity' kullandığı için mevcut element_file.txt 0-TABANLI düğüm
// indeksleri içeriyor (0..858), C++ ise 1-tabanlı etiket bekliyor (node-1). Burada 0 görülürse tüm
// referanslar +1 kaydırılır ve uyarı verilir. Kalıcı çözüm: export_mesh_duzeltilmis.py.
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <cstdlib>
#include "header.h"

using namespace std;

void Read_element_file(int nodes_element[NUMBER_ELEMS][NODES_PER_ELEM])
{
	ifstream infile("element_file.txt");
	if (!infile) {
		cerr << "HATA: element_file.txt acilamadi." << endl;
		exit(1);
	}
	string line;
	int e = 0, lineno = 0, minref = 1 << 30, maxref = -1;
	while (getline(infile, line) && e < NUMBER_ELEMS) {
		lineno++;
		if (line.find_first_not_of(" \t\r\n") == string::npos) continue;
		for (char& c : line) if (c == ',') c = ' ';
		istringstream ss(line);
		int label;
		if (!(ss >> label)) { cerr << "HATA: element_file.txt satir " << lineno << endl; exit(1); }
		for (int j = 0; j < NODES_PER_ELEM; j++) {
			if (!(ss >> nodes_element[e][j])) {
				cerr << "HATA: element_file.txt satir " << lineno << ": " << NODES_PER_ELEM
				     << " dugum bekleniyordu (NODES_PER_ELEM?)" << endl;
				exit(1);
			}
			minref = min(minref, nodes_element[e][j]);
			maxref = max(maxref, nodes_element[e][j]);
		}
		e++;
	}
	if (e != NUMBER_ELEMS) {
		cerr << "HATA: " << e << " eleman okundu, NUMBER_ELEMS = " << NUMBER_ELEMS << endl;
		exit(1);
	}
	if (minref == 0 && maxref == NUMBER_NODES - 1) {
		cerr << "UYARI: element_file.txt 0-tabanli dugum indeksleri iceriyor (export_mesh.py 'connectivity' hatasi). "
		     << "Tum referanslar +1 kaydiriliyor." << endl;
		for (int i = 0; i < NUMBER_ELEMS; i++)
			for (int j = 0; j < NODES_PER_ELEM; j++) nodes_element[i][j] += 1;
	} else if (minref < 1 || maxref > NUMBER_NODES) {
		cerr << "HATA: dugum referans araligi [" << minref << "," << maxref << "] gecersiz." << endl;
		exit(1);
	}
}
