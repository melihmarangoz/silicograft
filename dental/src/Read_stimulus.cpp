// Modified by Melih Marangoz in 2026 for the CalculiX port (changes marked [CCX]; see NOTICE).
// [CCX] Read_stimulus.cpp -- CalculiX .dat okuyucu (orijinal: Abaqus *EL PRINT EP, SP tablosu)
//
// Orijinal (main dali) davranisi korunur:
//   - eleman basina 4 integrasyon noktasi (C3D10) okunur, EP1 (en kucuk asal sekil degistirme) ve
//     HP = -(s1+s2+s3)/3 IP'ler uzerinden ortalanir
//   - siniflandirma esikleri ve sirasi birebir ayni (Claes-Heigele + rezorpsiyon bolgesi)
// Farklar:
//   - CalculiX *EL PRINT asal degerleri yazmaz; "S, E" tensorleri okunur. Asal sekil degistirmeler
//     simetrik tensorun ozdegerlerinden hesaplanir. CalculiX kayma bilesenlerini TENSOR olarak yazar
//     (exy = gamma_xy / 2; birim testle dogrulandi: araclar/birim_testler.sh).
//     tr(S) = s1+s2+s3 oldugu icin HP asal gerilme gerektirmez.
//   - satirlar eleman etiketiyle eslenir (sira kaymasi olmaz); dosya/tablo/eleman eksikse false doner
//     (orijinal: sonsuz dongu ya da sessizce varsayilan stimulus).
//   - bayat sonuc okumamak icin run.sh ccx'ten once eski .dat'i siler ve ccx basarisizsa hata doner.
// Isaret: varsayilan orijinal kod (HP < -0.15 -> kikirdak; HP basma-pozitif oldugundan fiilen CEKME).
//   -DCLAES_HEIGELE_BASMA_POZITIF ile Claes & Heigele (1999) yorumu: kikirdak hidrostatik BASMADA (HP > 0.15).
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <cmath>
#include <array>
#include "header.h"

using namespace std;

#ifndef STIMULUS_FILE
#define STIMULUS_FILE "without_scaffold.dat"
#endif

// simetrik 3x3 matrisin en kucuk ozdegeri (analitik, trigonometrik yontem)
static double min_eigen_sym(double a11, double a22, double a33, double a12, double a13, double a23)
{
	const double p1 = a12 * a12 + a13 * a13 + a23 * a23;
	if (p1 < 1e-30) return min(a11, min(a22, a33));
	const double q = (a11 + a22 + a33) / 3.0;
	const double b11 = a11 - q, b22 = a22 - q, b33 = a33 - q;
	const double p2 = b11 * b11 + b22 * b22 + b33 * b33 + 2.0 * p1;
	const double p = sqrt(p2 / 6.0);
	// det(B)/2 / p^3
	const double detB = b11 * (b22 * b33 - a23 * a23) - a12 * (a12 * b33 - a23 * a13) + a13 * (a12 * a23 - b22 * a13);
	double r = detB / (2.0 * p * p * p);
	r = max(-1.0, min(1.0, r));
	const double phi = acos(r) / 3.0;
	return q + 2.0 * p * cos(phi + 2.0 * M_PI / 3.0); // en kucuk
}

// "stresses (...)" ya da "strains (...)" tablosunu oku: eleman -> IP bazinda 6 bilesen
static bool read_table(const vector<string>& lines, const string& title, vector<vector<array<double, 6>>>& out)
{
	long start = -1;
	for (long i = (long)lines.size() - 1; i >= 0; --i) // son adimin tablosu
		if (lines[i].find(title) != string::npos && lines[i].find("for set") != string::npos) { start = i; break; }
	if (start < 0) return false;
	out.assign(NUMBER_ELEMS, {});
	for (size_t li = start + 1; li < lines.size(); ++li) {
		const string& s = lines[li];
		if (s.find('(') != string::npos) break; // sonraki tablo basligi
		istringstream ss(s);
		int elem, ip; array<double, 6> v;
		if (!(ss >> elem >> ip >> v[0] >> v[1] >> v[2] >> v[3] >> v[4] >> v[5])) continue; // bos satir
		const int idx = elem - FIRST_CALLUS_ELEMENT;
		if (idx < 0 || idx >= NUMBER_ELEMS) continue;
		out[idx].push_back(v);
	}
	return true;
}

bool Read_stimulus(char stimulus_read[NUMBER_ELEMS], int /*elements_read*/[NUMBER_ELEMS][NODES_PER_ELEM])
{
	ifstream infile(STIMULUS_FILE);
	if (!infile) {
		cerr << "HATA: " << STIMULUS_FILE << " acilamadi (CalculiX calisti mi?)." << endl;
		return false;
	}
	vector<string> lines;
	string line;
	while (getline(infile, line)) lines.push_back(line);

	vector<vector<array<double, 6>>> S, E;
	if (!read_table(lines, "stresses (elem", S) || !read_table(lines, "strains (elem", E)) {
		cerr << "HATA: " << STIMULUS_FILE << " icinde *EL PRINT S, E tablolari yok." << endl;
		return false;
	}

	int missing = 0;
	for (int elem = 0; elem < NUMBER_ELEMS; elem++) {
		if (S[elem].size() != (size_t)IPS_PER_ELEM || E[elem].size() != (size_t)IPS_PER_ELEM) { missing++; continue; }
		double min_E_read = 0, HP_read = 0;
		for (int j = 0; j < IPS_PER_ELEM; j++) {
			const auto& e = E[elem][j]; // exx eyy ezz exy exz eyz (tensor)
			const auto& s = S[elem][j];
			min_E_read += min_eigen_sym(e[0], e[1], e[2], e[3], e[4], e[5]); // EP1
			HP_read += -(s[0] + s[1] + s[2]) / 3;                            // -(SP1+SP2+SP3)/3
		}
		min_E_read /= IPS_PER_ELEM;
		HP_read /= IPS_PER_ELEM;

		// Define stimulus (orijinal main Read_stimulus.cpp ile ayni)
		if (fabs(HP_read) < 0.0016 && fabs(min_E_read) < 0.0004) {
			stimulus_read[elem] = 1; // resorption
		}
		else if (fabs(HP_read) < 0.15 && fabs(min_E_read) < 0.05) {
			stimulus_read[elem] = 2; // intramembranous (bone)
		}
#ifdef CLAES_HEIGELE_BASMA_POZITIF
		else if (HP_read > 0.15 && fabs(min_E_read) < 0.15) {
#else
		else if (HP_read < -0.15 && fabs(min_E_read) < 0.15) {
#endif
			stimulus_read[elem] = 4; // endochondral (cartilage)
		}
		else {
			stimulus_read[elem] = 5; // fibrocartilage or connective
		}
	}
	if (missing > 0) {
		cerr << "HATA: " << missing << "/" << NUMBER_ELEMS << " kallus elemani icin " << IPS_PER_ELEM << " IP verisi yok." << endl;
		return false;
	}
	return true;
}
