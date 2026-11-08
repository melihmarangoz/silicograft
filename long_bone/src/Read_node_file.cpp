// Modified by Melih Marangoz in 2026 for the CalculiX port (changes marked [CCX]; see NOTICE).
// [CCX] 05_Mechanabio/duzeltilmis_kod surumu: Read_node_file.cpp
// Orijinal sorunlar: (1) dosya açılmazsa sessizce devam ediyordu, (2) while(!eof) kalıbı son satırı
// iki kez işleyebiliyor, (3) düğüm etiketi 1..NUMBER_NODES dışında ise dizi taşması (UB) oluşuyordu.
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <cstdlib>
#include "header.h"

using namespace std;

void Read_node_file(float nodes_position[NUMBER_NODES][3])
{
	for (int i = 0; i < NUMBER_NODES; i++)
		for (int j = 0; j < 3; j++)
			nodes_position[i][j] = 999999;

	ifstream infile("node_file.txt");
	if (!infile) {
		cerr << "HATA: node_file.txt acilamadi." << endl;
		exit(1);
	}
	string line;
	int read = 0, lineno = 0;
	while (getline(infile, line)) {
		lineno++;
		if (line.find_first_not_of(" \t\r\n") == string::npos) continue; // boş satır
		for (char& c : line) if (c == ',') c = ' ';
		istringstream ss(line);
		int node; float x, y, z;
		if (!(ss >> node >> x >> y >> z)) {
			cerr << "HATA: node_file.txt satir " << lineno << " okunamadi: " << line << endl;
			exit(1);
		}
		if (node < 1 || node > NUMBER_NODES) {
			cerr << "HATA: dugum etiketi " << node << " [1," << NUMBER_NODES << "] disinda (header.h NUMBER_NODES?)" << endl;
			exit(1);
		}
		nodes_position[node - 1][0] = x;
		nodes_position[node - 1][1] = y;
		nodes_position[node - 1][2] = z;
		read++;
	}
	if (read != NUMBER_NODES)
		cerr << "UYARI: " << read << " dugum okundu, header.h NUMBER_NODES = " << NUMBER_NODES << endl;
}
